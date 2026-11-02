import { short } from "./text.js";
import type { Finding } from "./types.js";

/**
 * OAuth-tarkistus (--auth) HTTP-palvelimelle MCP:n valtuutusmäärittelyn mukaan:
 * 1. Kirjautumaton initialize-pyyntö: odotetaan 401 ja WWW-Authenticate: Bearer (resource_metadata=...).
 * 2. Suojatun resurssin metatiedot (RFC 9728): resource ja authorization_servers.
 * 3. Valtuutuspalvelimen metatiedot (RFC 8414 tai OpenID Connect Discovery): PKCE S256,
 *    refresh_token-myöntö, asiakkaan rekisteröinti ja https-osoitteet.
 * Tarkistus ei koskaan lähetä tunnuksia: pelkkiä kirjautumattomia GET-pyyntöjä ja yksi initialize-POST.
 * Se lähettää GET-pyynnöt myös palvelimen ilmoittamalle valtuutuspalvelimelle.
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_BODY = 256 * 1024;
const PROTOCOL_VERSION = "2025-06-18";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLocal(u: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

function secureOrLocal(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || (u.protocol === "http:" && isLocal(u));
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`response larger than ${MAX_BODY} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function getJson(fetchFn: FetchLike, url: string, timeoutMs: number): Promise<{ status: number; json?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetchFn(url, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    const text = await readCapped(res);
    if (!res.ok) return { status: res.status };
    try {
      const json = JSON.parse(text) as unknown;
      return isRecord(json) ? { status: res.status, json } : { status: res.status, error: "response is not a JSON object" };
    } catch {
      return { status: res.status, error: "response is not JSON" };
    }
  } catch (e) {
    return { status: 0, error: short(e instanceof Error ? e.message : String(e)) };
  }
}

/** RFC 9728 ja RFC 8414: well-known-polku lisätään hostin ja polun väliin (https://x/mcp -> https://x/.well-known/<nimi>/mcp). */
export function wellKnown(base: string, name: string): string[] {
  const u = new URL(base);
  const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
  const withPath = `${u.origin}/.well-known/${name}${path}`;
  const root = `${u.origin}/.well-known/${name}`;
  return path ? [withPath, root] : [root];
}

/** Poimii WWW-Authenticate-otsakkeesta skeeman ja resource_metadata-parametrin. */
export function parseWwwAuthenticate(header: string | null): { bearer: boolean; resourceMetadata?: string } {
  if (!header) return { bearer: false };
  const bearer = /^\s*bearer\b/i.test(header) || /,\s*bearer\b/i.test(header);
  const m = /resource_metadata\s*=\s*"([^"]+)"/i.exec(header) ?? /resource_metadata\s*=\s*([^\s,]+)/i.exec(header);
  return m ? { bearer, resourceMetadata: m[1] } : { bearer };
}

function f(id: string, severity: Finding["severity"], message: string): Finding {
  return { id, severity, message };
}

export async function authCheck(serverUrl: string, fetchFn: FetchLike, timeoutMs: number): Promise<Finding[]> {
  const out: Finding[] = [];
  const server = new URL(serverUrl);
  const resourceId = `${server.origin}${server.pathname}`;

  // 1. Kirjautumaton initialize.
  let www: string | null = null;
  try {
    const res = await fetchFn(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PROTOCOL_VERSION },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "mcp-doctor-auth", version: "0" } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.body?.cancel().catch(() => undefined);
    if (res.status !== 401) {
      out.push(f("AUTH_NOT_REQUIRED", "info", `server answered the unauthenticated initialize request with status ${res.status}, not 401: login is not required, skipping the OAuth check`));
      return out;
    }
    www = res.headers.get("www-authenticate");
  } catch (e) {
    out.push(f("AUTH_CHECK_FAILED", "error", `unauthenticated initialize request failed: ${short(e instanceof Error ? e.message : String(e))}`));
    return out;
  }

  const parsed = parseWwwAuthenticate(www);
  if (!www || !parsed.bearer) {
    out.push(f("AUTH_WWW_AUTHENTICATE_MISSING", "warning", "the 401 response has no WWW-Authenticate: Bearer header: the client gets no hint about where to find login details"));
  } else if (!parsed.resourceMetadata) {
    out.push(f("AUTH_RESOURCE_METADATA_HINT_MISSING", "info", "the WWW-Authenticate header has no resource_metadata parameter: the client has to guess the metadata URL (well-known)"));
  }

  // 2. Suojatun resurssin metatiedot.
  const prmCandidates = [...(parsed.resourceMetadata ? [parsed.resourceMetadata] : []), ...wellKnown(serverUrl, "oauth-protected-resource")];
  let prm: Record<string, unknown> | undefined;
  let prmUrl = "";
  const tried: string[] = [];
  for (const u of prmCandidates) {
    if (!secureOrLocal(u)) {
      out.push(f("AUTH_INSECURE_URL", "error", `metadata URL is not https: ${short(u)}`));
      continue;
    }
    const r = await getJson(fetchFn, u, timeoutMs);
    if (r.json) {
      prm = r.json;
      prmUrl = u;
      break;
    }
    tried.push(`${short(u)} (${r.error ?? r.status})`);
  }
  if (!prm) {
    out.push(f("AUTH_RESOURCE_METADATA_MISSING", "error", `protected resource metadata (RFC 9728) not found: ${tried.join("; ")}`));
    return out;
  }
  if (typeof prm.resource !== "string") {
    out.push(f("AUTH_RESOURCE_INVALID", "error", `metadata (${short(prmUrl)}) has no resource field`));
  } else if (prm.resource.replace(/\/$/, "") !== resourceId.replace(/\/$/, "") && prm.resource.replace(/\/$/, "") !== server.origin) {
    out.push(f("AUTH_RESOURCE_MISMATCH", "warning", `metadata resource '${short(prm.resource)}' does not match the server URL '${short(resourceId)}': a client may reject the token or request it for the wrong resource`));
  }
  const servers = Array.isArray(prm.authorization_servers) ? prm.authorization_servers.filter((x): x is string => typeof x === "string") : [];
  if (servers.length === 0) {
    out.push(f("AUTH_SERVERS_MISSING", "error", "metadata has no authorization_servers: the client does not know where to log in"));
    return out;
  }

  // 3. Valtuutuspalvelimen metatiedot (ensimmäinen ilmoitettu).
  const as = servers[0];
  if (!secureOrLocal(as)) {
    out.push(f("AUTH_INSECURE_URL", "error", `authorization server is not https: ${short(as)}`));
    return out;
  }
  const asCandidates = [...wellKnown(as, "oauth-authorization-server"), ...wellKnown(as, "openid-configuration")];
  let meta: Record<string, unknown> | undefined;
  const asTried: string[] = [];
  for (const u of asCandidates) {
    const r = await getJson(fetchFn, u, timeoutMs);
    if (r.json) {
      meta = r.json;
      break;
    }
    asTried.push(`${short(u)} (${r.error ?? r.status})`);
  }
  if (!meta) {
    out.push(f("AUTH_SERVER_METADATA_MISSING", "error", `authorization server metadata (RFC 8414 / OpenID) not found: ${asTried.join("; ")}`));
    return out;
  }
  for (const key of ["authorization_endpoint", "token_endpoint"]) {
    const v = meta[key];
    if (typeof v !== "string") out.push(f("AUTH_ENDPOINT_MISSING", "error", `authorization server metadata has no ${key}`));
    else if (!secureOrLocal(v)) out.push(f("AUTH_INSECURE_URL", "error", `${key} is not https: ${short(v)}`));
  }
  const pkce = meta.code_challenge_methods_supported;
  if (!Array.isArray(pkce) || !pkce.includes("S256")) {
    out.push(f("AUTH_PKCE_S256_MISSING", "error", "code_challenge_methods_supported is missing or lacks S256: MCP clients require PKCE and may refuse to log in"));
  }
  const grants = meta.grant_types_supported;
  if (Array.isArray(grants) && !grants.includes("refresh_token")) {
    out.push(f("AUTH_REFRESH_TOKEN_UNSUPPORTED", "warning", "grant_types_supported does not include refresh_token: when the token expires, the user has to log in again (\"connection expired\")"));
  }
  if (typeof meta.registration_endpoint !== "string" && meta.client_id_metadata_document_supported !== true) {
    out.push(f("AUTH_REGISTRATION_UNSUPPORTED", "info", "no registration_endpoint and no client_id_metadata_document_supported: the client must be given a pre-registered client_id"));
  }
  if (out.every((x) => x.severity === "info")) {
    out.push(f("AUTH_OK", "info", `OAuth metadata is fine (resource ${short(prmUrl)}, authorization server ${short(as)})`));
  }
  return out;
}
