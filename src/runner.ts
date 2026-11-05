import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { lintTools } from "./lint.js";
import { summarize } from "./report.js";
import { measureTools, tokenFindings } from "./tokens.js";
import { short } from "./text.js";
import { VERSIO } from "./versio.js";
import type { Finding, Report, SmokeCall, SmokeResult, ToolLike } from "./types.js";

export interface DiagnoseOptions {
  transport: Transport;
  target: string;
  smoke?: SmokeCall[];
  timeoutMs: number;
  strict: boolean;
  /** Tokenimittarin raja (--max-tokens): ylitys on virhe. */
  maxTokens?: number;
  /** Palauttaa viimeisimmän server stderr-tekstin (vain stdio), liitetään yhteysvirheeseen. */
  stderrTail?: () => string;
}

const MAX_PAGES = 50;

function errText(e: unknown): string {
  return short(e instanceof Error ? e.message : String(e));
}

/** HTTP-tila, jos yhteysvirhe on SDK:n StreamableHTTPError (code = tilakoodi). Muu virhe ei anna tilaa. */
function httpStatusOf(e: unknown): number | undefined {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "number" && Number.isInteger(code) && code >= 400 && code <= 599 ? code : undefined;
}

/** Selkeä vihje, kun palvelin esti pyynnön tilalla 401 tai 403. Ei ehdota eston kiertämistä. */
function blockedHint(status: number): string {
  if (status === 401) {
    return "the server requires login. Pass a token with --bearer-env, or run --auth to see the server's OAuth details";
  }
  return "the server blocked the request and does not accept it with these credentials or from this network (for example a missing permission, an IP restriction or bot protection). Check the token and permissions (--bearer-env), or run --auth to see whether the server requires OAuth login. mcp-doctor does not try to bypass the block";
}

function firstText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const c of content) {
    if (c && typeof c === "object" && (c as { type?: unknown }).type === "text" && typeof (c as { text?: unknown }).text === "string") {
      return short((c as { text: string }).text);
    }
  }
  return "";
}

function build(opts: DiagnoseOptions, server: Report["server"], toolCount: number, findings: Finding[], smoke: SmokeResult[], tokens?: Report["tokens"]): Report {
  const summary = summarize(findings);
  const ok = summary.errors === 0 && (!opts.strict || summary.warnings === 0);
  const base = { version: 1 as const, target: opts.target, server, toolCount, findings, smoke };
  return tokens ? { ...base, tokens, summary, ok } : { ...base, summary, ok };
}

/** Yhdistää palvelimeen, tarkistaa työkalut ja ajaa savuajon. Ei koskaan heitä: virheet ovat löydöksiä. */
export async function diagnose(opts: DiagnoseOptions): Promise<Report> {
  const findings: Finding[] = [];
  const smokeResults: SmokeResult[] = [];
  // Huom: SDK:n asiakas tarkistaa itse outputSchema-vaatimuksen (puuttuva tai virheellinen structuredContent
  // heittää virheen), ja se näkyy löydöksenä SMOKE_CALL_FAILED.
  const client = new Client({ name: "mcp-doctor", version: VERSIO });
  try {
    try {
      await client.connect(opts.transport, { timeout: opts.timeoutMs });
    } catch (e) {
      const tail = opts.stderrTail?.().trim();
      const extra = tail ? ` | server stderr: ${short(tail)}` : "";
      const status = httpStatusOf(e);
      const blocked = status === 401 || status === 403 ? ` | HTTP ${status}: ${blockedHint(status)}` : "";
      findings.push({ id: "CONNECT_FAILED", severity: "error", message: `connection or initialize handshake failed: ${errText(e)}${blocked}${extra}` });
      return build(opts, null, 0, findings, smokeResults);
    }

    const info = client.getServerVersion();
    const server = info ? { name: String(info.name), version: String(info.version) } : null;
    if (!server || !server.name) {
      findings.push({ id: "SERVER_INFO_MISSING", severity: "warning", message: "server did not report its name and version (serverInfo)" });
    }

    const caps = client.getServerCapabilities();
    const tools: ToolLike[] = [];
    // Tosi, kun työkalulistaa ei saatu (kyky puuttuu tai tools/list epäonnistui): savuajon "työkalua ei löydy" ei silloin tarkoita, että työkalua ei ole.
    let toolListMissing = false;
    let tokens: Report["tokens"];
    if (!caps?.tools) {
      toolListMissing = true;
      findings.push({ id: "TOOLS_CAPABILITY_MISSING", severity: "warning", message: "server does not declare the tools capability, tools are not listed" });
    } else {
      let cursor: string | undefined;
      let pages = 0;
      const seenCursors = new Set<string>();
      try {
        do {
          const res = await client.listTools(cursor ? { cursor } : undefined, { timeout: opts.timeoutMs });
          tools.push(...(res.tools as ToolLike[]));
          cursor = res.nextCursor;
          pages++;
          if (cursor) {
            if (seenCursors.has(cursor)) {
              findings.push({ id: "TOOLS_PAGINATION_LOOP", severity: "warning", message: `server returned the same nextCursor again, tool listing stopped after ${pages} pages` });
              cursor = undefined;
              break;
            }
            seenCursors.add(cursor);
          }
        } while (cursor && pages < MAX_PAGES);
        if (cursor) findings.push({ id: "TOOLS_PAGINATION_LIMIT", severity: "warning", message: `tool listing stopped after ${MAX_PAGES} pages` });
      } catch (e) {
        toolListMissing = true;
        findings.push({ id: "TOOLS_LIST_FAILED", severity: "error", message: `tools/list failed: ${errText(e)}` });
      }
      if (tools.length === 0 && !findings.some((f) => f.id === "TOOLS_LIST_FAILED")) {
        findings.push({ id: "TOOLS_EMPTY", severity: "warning", message: "server declares the tools capability but the tool list is empty" });
      }
      findings.push(...lintTools(tools));
      if (!toolListMissing) {
        tokens = measureTools(tools, opts.maxTokens);
        findings.push(...tokenFindings(tokens));
      }
    }

    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const call of opts.smoke ?? []) {
      const tool = byName.get(call.tool);
      if (!tool) {
        const syy = toolListMissing
          ? "no tool list available (tools/list failed or the tools capability is missing), so the smoke tool could not be looked up"
          : "the tool named in the smoke file is not on the server's list";
        findings.push({ id: "SMOKE_TOOL_NOT_FOUND", severity: "error", tool: call.tool, message: syy });
        smokeResults.push({ tool: call.tool, ok: false, ms: 0 });
        continue;
      }
      const start = Date.now();
      let ok = true;
      const fail = (id: string, severity: Finding["severity"], message: string) => {
        findings.push({ id, severity, tool: call.tool, message });
        if (severity === "error") ok = false;
      };
      try {
        const res = await client.callTool({ name: call.tool, arguments: call.arguments }, undefined, { timeout: opts.timeoutMs });
        const ms = Date.now() - start;
        const isError = res.isError === true;
        if (isError && !call.expectError) fail("SMOKE_TOOL_ERROR", "error", `tool returned an error: ${firstText(res.content) || "(no text)"}`);
        else if (!isError && call.expectError) fail("SMOKE_EXPECTED_ERROR", "error", "the tool was expected to return an error, but the call succeeded");
        if (!isError) {
          const hasContent = Array.isArray(res.content) && res.content.length > 0;
          if (!hasContent && res.structuredContent === undefined) fail("SMOKE_EMPTY_RESULT", "warning", "tool returned an empty result");
        }
        if (ms > call.maxMs) fail("SMOKE_SLOW", "warning", `response took ${ms} ms (limit ${call.maxMs} ms)`);
        smokeResults.push({ tool: call.tool, ok, ms });
      } catch (e) {
        // JSON-RPC-virhe (esim. -32602 Invalid params) on protokollatason tapa kertoa virheestä. Kun virhe odotetaan, se kelpaa;
        // aikakatkaisu ja katkennut yhteys eivät ole odotettu virhe.
        const protocolError = e instanceof McpError && e.code !== ErrorCode.RequestTimeout && e.code !== ErrorCode.ConnectionClosed;
        if (protocolError && call.expectError) {
          fail("SMOKE_EXPECTED_PROTOCOL_ERROR", "info", `the expected error came as a JSON-RPC error (${e.code}), not as an isError result: ${errText(e)}`);
        } else {
          fail("SMOKE_CALL_FAILED", "error", `call failed: ${errText(e)}`);
        }
        smokeResults.push({ tool: call.tool, ok, ms: Date.now() - start });
      }
    }
    return build(opts, server, tools.length, findings, smokeResults, tokens);
  } finally {
    await client.close().catch(() => undefined);
  }
}
