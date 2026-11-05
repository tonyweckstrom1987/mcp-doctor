import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { USAGE } from "../src/cli.js";
import { formatText, summarize } from "../src/report.js";

// Käyttäjälle näkyvä teksti on englantia. Kommentit saavat olla suomeksi, joten ne poistetaan ennen tarkistusta.
const SUOMI = /[äöÄÖ]|\b(virhe|varoitus|huomio|palvelin|puuttuu|kuvaus|valinta|yhteenveto|savuajo|kentt|tyokalu|kesti|raja|vastaus)/i;

function ilmanKommentteja(lahde: string): string {
  return lahde
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((r) => r.replace(/(^|\s)\/\/\s.*$/, ""))
    .join("\n");
}

function merkkijonot(koodi: string): string[] {
  return [...koodi.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
}

describe("käyttäjälle näkyvä kieli", () => {
  const src = new URL("../src/", import.meta.url);

  it.each(readdirSync(src).filter((n) => n.endsWith(".ts")))("%s: merkkijonot ovat englantia", (nimi) => {
    const koodi = ilmanKommentteja(readFileSync(new URL(nimi, src), "utf8"));
    expect(merkkijonot(koodi).filter((s) => SUOMI.test(s))).toEqual([]);
  });

  it("ohje ja tekstiraportti ovat englantia", () => {
    const findings = [{ id: "X", severity: "error" as const, message: "m" }];
    const raportti = formatText({ version: 1, target: "t", server: null, toolCount: 0, findings, smoke: [{ tool: "a", ok: false, ms: 1 }], summary: summarize(findings), ok: false } as never);
    expect(USAGE).not.toMatch(SUOMI);
    expect(raportti).not.toMatch(SUOMI);
  });

  it.each(["../docs/fixes.md", "../README.md"])("%s: esimerkkitulosteet ovat englantia", (polku) => {
    const rivit = readFileSync(new URL(polku, import.meta.url), "utf8").split(/\r?\n/);
    const tuloste = rivit.filter((r) => /^[A-ZÄÖ]+ +\[[A-Z0-9_]+\]/.test(r) || /^(Tokenit|Tokens) \(/.test(r));
    expect(tuloste.length).toBeGreaterThan(0);
    expect(tuloste.filter((r) => SUOMI.test(r) || !/^(ERROR|WARNING|INFO|Tokens)\b/.test(r))).toEqual([]);
  });

  it("action.yml: syötekuvaukset ovat englantia", () => {
    const action = parse(readFileSync(new URL("../action.yml", import.meta.url), "utf8")) as { inputs: Record<string, { description: string }> };
    for (const [nimi, syote] of Object.entries(action.inputs)) expect(`${nimi}: ${syote.description}`).not.toMatch(SUOMI);
  });
});
