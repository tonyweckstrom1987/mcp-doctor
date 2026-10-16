import type { Finding, ToolLike } from "./types.js";

const NAME_STRICT = /^[A-Za-z0-9_-]{1,64}$/;
const NAME_SPEC = /^[A-Za-z0-9_.-]{1,128}$/;
const TYPE_KEYS = ["type", "enum", "const", "$ref", "anyOf", "oneOf", "allOf"];
const SHORT_DESCRIPTION = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function find(id: string, severity: Finding["severity"], tool: string, message: string): Finding {
  return { id, severity, tool, message };
}

function lintSchema(tool: string, schema: unknown, kind: "input" | "output"): Finding[] {
  const out: Finding[] = [];
  const label = kind === "input" ? "syöteskeema" : "tulosskeema";
  if (!isRecord(schema) || schema.type !== "object") {
    out.push(find(kind === "input" ? "SCHEMA_NOT_OBJECT" : "OUTPUT_SCHEMA_NOT_OBJECT", "error", tool, `${label} puuttuu tai sen type ei ole "object"`));
    return out;
  }
  const props = isRecord(schema.properties) ? schema.properties : undefined;
  if (kind === "output") return out;

  const required = schema.required;
  if (required !== undefined) {
    if (!Array.isArray(required) || required.some((r) => typeof r !== "string")) {
      out.push(find("SCHEMA_REQUIRED_INVALID", "error", tool, "required ei ole merkkijonolista"));
    } else {
      for (const r of required) {
        if (!props || !(r in props)) {
          out.push(find("SCHEMA_REQUIRED_UNKNOWN", "error", tool, `pakollinen kenttä '${r}' ei ole properties-listassa`));
        }
      }
    }
  }
  if (props) {
    for (const [name, def] of Object.entries(props)) {
      if (!isRecord(def)) {
        out.push(find("SCHEMA_PROP_UNTYPED", "warning", tool, `kentän '${name}' skeema ei ole objekti`));
        continue;
      }
      if (!TYPE_KEYS.some((k) => k in def)) {
        out.push(find("SCHEMA_PROP_UNTYPED", "warning", tool, `kentällä '${name}' ei ole tyyppiä (type/enum/const/$ref/anyOf/oneOf/allOf): skeema on liian väljä`));
      }
      if (typeof def.description !== "string" || def.description.trim() === "") {
        out.push(find("SCHEMA_PROP_DESC_MISSING", "warning", tool, `kentältä '${name}' puuttuu kuvaus`));
      }
    }
  }
  return out;
}

/** Tarkistaa työkalulistan ja niiden skeemat. Puhdas funktio, ei verkkoa. */
export function lintTools(tools: ToolLike[]): Finding[] {
  const out: Finding[] = [];
  const seen = new Map<string, number>();
  for (const t of tools) seen.set(t.name, (seen.get(t.name) ?? 0) + 1);
  for (const [name, n] of seen) {
    if (n > 1) out.push(find("TOOL_DUPLICATE", "error", name, `työkalun nimi esiintyy ${n} kertaa`));
  }
  const reported = new Set<string>();
  for (const t of tools) {
    if (reported.has(t.name)) continue; // duplikaatin skeema tarkistetaan kerran
    reported.add(t.name);
    if (!NAME_SPEC.test(t.name)) {
      out.push(find("TOOL_NAME_INVALID", "error", t.name, "nimi on tyhjä, yli 128 merkkiä tai sisältää sallittujen merkkien (A-Z a-z 0-9 _ - .) ulkopuolisia merkkejä"));
    } else if (!NAME_STRICT.test(t.name)) {
      out.push(find("TOOL_NAME_PORTABILITY", "warning", t.name, "nimi ei sovi muotoon [A-Za-z0-9_-]{1,64}, jota osa asiakkaista (esim. Claude API) vaatii"));
    }
    const desc = typeof t.description === "string" ? t.description.trim() : "";
    if (desc === "") out.push(find("TOOL_DESC_MISSING", "warning", t.name, "kuvaus puuttuu: malli ei tiedä milloin työkalua kuuluu käyttää"));
    else if (desc.length < SHORT_DESCRIPTION) out.push(find("TOOL_DESC_SHORT", "info", t.name, `kuvaus on hyvin lyhyt (${desc.length} merkkiä)`));
    out.push(...lintSchema(t.name, t.inputSchema, "input"));
    if (t.outputSchema !== undefined) out.push(...lintSchema(t.name, t.outputSchema, "output"));
  }
  return out;
}
