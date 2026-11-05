import { readFileSync } from "node:fs";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { authCheck } from "./auth.js";
import { redactArgs } from "./redact.js";
import { formatJson, formatText, summarize } from "./report.js";
import { diagnose } from "./runner.js";
import { parseSmokeSpec } from "./smoke.js";
import { short } from "./text.js";
import { type Finding, UsageError } from "./types.js";
import { VERSIO } from "./versio.js";

export const EXIT_OK = 0;
export const EXIT_FINDINGS = 1;
export const EXIT_USAGE = 2;
export const EXIT_INTERNAL = 3;

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  env: Record<string, string | undefined>;
  readFile: (path: string) => string;
}

export const USAGE = `mcp-doctor - health check for MCP servers

Usage:
  mcp-doctor [options] -- <command> [arguments...]       stdio server
  mcp-doctor [options] --url <http(s) address>           HTTP server (Streamable HTTP)

Options:
  --smoke <file>         smoke calls: calls only the tools named in the file
  --json                 print the report as JSON
  --strict               warnings fail the run too (exit 1)
  --timeout-ms <number>  timeout for a single request, default 10000
  --max-tokens <number>  token budget: the estimated total size of the tool definitions must not exceed this (exceeding it is an error)
  --env <NAME>           pass an environment variable to the stdio server (repeatable)
  --bearer-env <NAME>    read the HTTP server's Bearer token from this environment variable
  --auth                 OAuth check for an HTTP server: 401 and WWW-Authenticate, resource and authorization server
                         metadata, PKCE S256, refresh_token (unauthenticated requests, also to the authorization server)
  --version              print the version
  --help                 this help

Exit codes: 0 healthy, 1 findings (an error, or a warning with --strict), 2 usage or file error, 3 unexpected internal error.
`;

interface Args {
  command: string[];
  flags: Map<string, string[]>;
  bools: Set<string>;
}

const BOOL_FLAGS = new Set(["json", "strict", "help", "version", "auth"]);
const VALUE_FLAGS = new Set(["smoke", "timeout-ms", "env", "bearer-env", "url", "max-tokens"]);

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string[]>();
  const bools = new Set<string>();
  let command: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      command = argv.slice(i + 1);
      break;
    }
    if (!a.startsWith("--")) throw new UsageError(`Unexpected argument '${a}' (the server command goes after '--')`);
    const name = a.slice(2);
    if (BOOL_FLAGS.has(name)) bools.add(name);
    else if (VALUE_FLAGS.has(name)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`Option --${name} needs a value`);
      flags.set(name, [...(flags.get(name) ?? []), v]);
    } else throw new UsageError(`Unknown option --${name}`);
  }
  return { command, flags, bools };
}

function one(args: Args, name: string): string | undefined {
  const v = args.flags.get(name);
  if (!v) return undefined;
  if (v.length > 1) throw new UsageError(`Option --${name} can be given only once`);
  return v[0];
}

/** Ajaa komentorivin ja palauttaa poistumiskoodin. Ei kutsu process.exit-funktiota. */
export async function main(argv: string[], io: CliIo): Promise<number> {
  try {
    // Vain '--'-merkkiä edeltävät argumentit ovat meidän: palvelimen oma '--help' ei saa laukaista ohjetta.
    const ennenErotinta = argv.includes("--") ? argv.slice(0, argv.indexOf("--")) : argv;
    if (ennenErotinta.includes("--version")) {
      io.stdout(`${VERSIO}\n`);
      return EXIT_OK;
    }
    if (ennenErotinta.includes("--help")) {
      io.stdout(USAGE);
      return EXIT_OK;
    }
    if (argv.length === 0) {
      io.stderr(USAGE);
      return EXIT_USAGE;
    }
    const args = parseArgs(argv);
    const url = one(args, "url");
    if (url !== undefined && args.command.length > 0) throw new UsageError("Give either --url or a command after '--', not both");
    if (url === undefined && args.command.length === 0) throw new UsageError("Give a server: --url <address> or a command after '--'");
    const timeoutRaw = one(args, "timeout-ms");
    const timeoutMs = timeoutRaw === undefined ? 10000 : Number(timeoutRaw);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new UsageError("--timeout-ms must be a positive integer");
    const maxTokensRaw = one(args, "max-tokens");
    const maxTokens = maxTokensRaw === undefined ? undefined : Number(maxTokensRaw);
    if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1)) throw new UsageError("--max-tokens must be a positive integer");

    const smokePath = one(args, "smoke");
    let smoke;
    if (smokePath !== undefined) {
      let text: string;
      try {
        text = io.readFile(smokePath);
      } catch {
        throw new UsageError(`Cannot read the smoke file '${smokePath}'`);
      }
      smoke = parseSmokeSpec(text);
    }

    if (args.bools.has("auth") && url === undefined) throw new UsageError("--auth applies only to --url servers");

    let transport: Transport;
    let target: string;
    let stderrTail: (() => string) | undefined;
    if (url !== undefined) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new UsageError(`Invalid address '${url}'`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new UsageError("--url: only http and https are allowed");
      if (args.flags.has("env")) throw new UsageError("--env applies only to stdio servers");
      const bearerEnv = one(args, "bearer-env");
      let requestInit: RequestInit | undefined;
      if (bearerEnv !== undefined) {
        const token = io.env[bearerEnv];
        if (!token) throw new UsageError(`Environment variable ${bearerEnv} is empty or missing`);
        requestInit = { headers: { Authorization: `Bearer ${token}` } };
        if (parsed.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
          io.stderr(`Warning: the Bearer token is sent unencrypted (http) to ${parsed.hostname}. Use https.\n`);
        }
      }
      transport = new StreamableHTTPClientTransport(parsed, requestInit ? { requestInit } : undefined);
      target = `${parsed.origin}${parsed.pathname}`; // ei kyselyparametreja eikä tunnuksia tulosteisiin
    } else {
      if (args.flags.has("bearer-env")) throw new UsageError("--bearer-env applies only to --url servers");
      const env: Record<string, string> = {};
      for (const name of args.flags.get("env") ?? []) {
        const v = io.env[name];
        if (v === undefined) throw new UsageError(`Environment variable ${name} is not set`);
        env[name] = v;
      }
      const [command, ...rest] = args.command;
      const stdio = new StdioClientTransport({ command, args: rest, env: { ...getSafeEnv(io.env), ...env }, stderr: "pipe" });
      let tail = "";
      stdio.stderr?.on("data", (d: Buffer | string) => {
        tail = (tail + d.toString()).slice(-1000);
      });
      stderrTail = () => tail;
      transport = stdio;
      target = redactArgs(args.command).join(" "); // salaiselta näyttävät argumentit peitetään tulosteista
    }

    const strict = args.bools.has("strict");
    const authFindings = args.bools.has("auth") && url !== undefined ? await authCheck(url, (u, init) => fetch(u, init), timeoutMs) : [];
    let report = await diagnose({ transport, target, smoke, timeoutMs, strict, maxTokens, stderrTail });
    if (authFindings.length > 0) {
      // Kun palvelin vaati kirjautumisen (401) eikä tokenia annettu, kirjautumaton yhteys epäonnistuu odotetusti.
      // Se ei ole vika, joten CONNECT_FAILED muutetaan tiedoksi (muuten jokainen OAuth-palvelin näyttäisi rikkinäiseltä).
      const loginRequired = !args.flags.has("bearer-env") && !authFindings.some((x) => x.id === "AUTH_NOT_REQUIRED" || x.id === "AUTH_FORBIDDEN" || x.id === "AUTH_CHECK_FAILED");
      const rest = loginRequired
        ? report.findings.map((x): Finding => (x.id === "CONNECT_FAILED"
          ? { id: "AUTH_LOGIN_REQUIRED", severity: "info", message: "server requires login: the full check cannot run without a token (--bearer-env)" }
          : x))
        : report.findings;
      const findings = [...authFindings, ...rest];
      const summary = summarize(findings);
      report = { ...report, findings, summary, ok: summary.errors === 0 && (!strict || summary.warnings === 0) };
    }
    io.stdout(args.bools.has("json") ? formatJson(report) : formatText(report));
    return report.ok ? EXIT_OK : EXIT_FINDINGS;
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(`Error: ${err.message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    io.stderr(`Unexpected error: ${short(err instanceof Error ? err.message : String(err))}\n`);
    return EXIT_INTERNAL;
  }
}

/** Vain PATH ja perusmuuttujat: tarkastettava palvelin ei näe muuta ympäristöä kuin --env:llä nimetyn. */
function getSafeEnv(env: Record<string, string | undefined>): Record<string, string> {
  const keep = process.platform === "win32"
    ? ["PATH", "PATHEXT", "SYSTEMROOT", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"]
    : ["PATH", "HOME", "LANG", "TMPDIR", "SHELL", "USER"];
  const out: Record<string, string> = {};
  for (const k of keep) {
    const v = env[k];
    if (v !== undefined && !v.startsWith("()")) out[k] = v;
  }
  return out;
}

export function realIo(): CliIo {
  return {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    env: process.env,
    readFile: (p) => readFileSync(p, "utf8"),
  };
}
