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
    throw new UsageError("The smoke file is not valid JSON");
  }
  const calls = Array.isArray(data) ? data : isRecord(data) ? data.calls : undefined;
  if (!Array.isArray(calls)) throw new UsageError('The smoke file must be an array or {"calls": [...]}');
  if (calls.length === 0) throw new UsageError("The smoke file has no calls: an empty smoke run would report OK although nothing was tested");
  const out: SmokeCall[] = [];
  calls.forEach((c, i) => {
    const at = `calls[${i}]`;
    if (!isRecord(c)) throw new UsageError(`${at}: must be an object`);
    if (typeof c.tool !== "string" || c.tool === "") throw new UsageError(`${at}: tool is missing`);
    if (c.arguments !== undefined && !isRecord(c.arguments)) throw new UsageError(`${at}: arguments must be an object`);
    if (c.expectError !== undefined && typeof c.expectError !== "boolean") throw new UsageError(`${at}: expectError must be true or false`);
    if (c.maxMs !== undefined && !(typeof c.maxMs === "number" && Number.isFinite(c.maxMs) && c.maxMs > 0)) {
      throw new UsageError(`${at}: maxMs must be a positive number`);
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
