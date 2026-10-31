import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import type { Report } from "../src/types.js";
import { NODE, makeIo } from "./helpers.js";

// Pitää docs/demo.md:n ja examples/demo/-palvelimet totena: jos tarkistukset tai
// demopalvelimet muuttuvat, demo-ohjeen tuloste ei saa vanhentua huomaamatta.
const demo = (f: string) => fileURLToPath(new URL(`../examples/demo/${f}`, import.meta.url));
const savuajo = readFileSync(demo("savuajo.json"), "utf8");

async function aja(palvelin: string): Promise<{ code: number; r: Report }> {
  const io = makeIo({}, { "savuajo.json": savuajo });
  const code = await main(["--json", "--strict", "--smoke", "savuajo.json", "--", NODE, demo(palvelin)], io);
  return { code, r: JSON.parse(io.out) as Report };
}

describe("demo (docs/demo.md)", () => {
  it("ennen.mjs: viisi dokumentoitua vikaa löytyy ja ajo kaatuu", async () => {
    const { code, r } = await aja("ennen.mjs");
    expect(code).toBe(1);
    const loydokset = r.findings.map((f) => `${f.id} ${f.tool}`).sort();
    expect(loydokset).toEqual(
      [
        "SCHEMA_PROP_DESC_MISSING add_note",
        "SCHEMA_PROP_DESC_MISSING add_note",
        "SCHEMA_PROP_DESC_MISSING search_notes",
        "SCHEMA_PROP_UNTYPED search_notes",
        "SMOKE_TOOL_ERROR search_notes",
        "TOOL_DESC_MISSING delete_note",
        "TOOL_DESC_SHORT search_notes",
      ].sort(),
    );
    expect(r.summary).toEqual({ errors: 1, warnings: 5, infos: 1 });
    expect(r.smoke.map((s) => [s.tool, s.ok])).toEqual([
      ["add_note", true],
      ["search_notes", false],
      ["delete_note", true],
    ]);
  });

  it("jalkeen.mjs: korjattu palvelin menee läpi --strict-tilassa ilman löydöksiä", async () => {
    const { code, r } = await aja("jalkeen.mjs");
    expect(code).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.smoke.every((s) => s.ok)).toBe(true);
    expect(r.toolCount).toBe(3);
  });
});
