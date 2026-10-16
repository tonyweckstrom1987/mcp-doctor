import { UsageError, type SmokeCall } from "./types.js";

export const DEFAULT_MAX_MS = 5000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Savuajotiedosto: {"calls": [{"tool": "nimi", "arguments": {...}, "expectError": false, "maxMs": 5000}]}
 * (tai pelkkä taulukko). Vain tiedostossa nimetyt työkalut kutsutaan, mitään ei arvata.
 */
export function parseSmokeSpec(text: string): SmokeCall[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new UsageError("Savuajotiedosto ei ole kelvollista JSONia");
  }
  const calls = Array.isArray(data) ? data : isRecord(data) ? data.calls : undefined;
  if (!Array.isArray(calls)) throw new UsageError('Savuajotiedoston pitää olla taulukko tai {"calls": [...]}');
  const out: SmokeCall[] = [];
  calls.forEach((c, i) => {
    const at = `calls[${i}]`;
    if (!isRecord(c)) throw new UsageError(`${at}: pitää olla objekti`);
    if (typeof c.tool !== "string" || c.tool === "") throw new UsageError(`${at}: tool puuttuu`);
    if (c.arguments !== undefined && !isRecord(c.arguments)) throw new UsageError(`${at}: arguments pitää olla objekti`);
    if (c.expectError !== undefined && typeof c.expectError !== "boolean") throw new UsageError(`${at}: expectError pitää olla true tai false`);
    if (c.maxMs !== undefined && !(typeof c.maxMs === "number" && Number.isFinite(c.maxMs) && c.maxMs > 0)) {
      throw new UsageError(`${at}: maxMs pitää olla positiivinen luku`);
    }
    out.push({
      tool: c.tool,
      arguments: (c.arguments as Record<string, unknown> | undefined) ?? {},
      expectError: c.expectError === true,
      maxMs: (c.maxMs as number | undefined) ?? DEFAULT_MAX_MS,
    });
  });
  return out;
}
