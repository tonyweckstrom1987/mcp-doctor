import { describe, expect, it } from "vitest";
import { formatJson, formatText, summarize } from "../src/report.js";
import type { Finding, Report } from "../src/types.js";

const findings: Finding[] = [
  { id: "A_INFO", severity: "info", message: "huomio" },
  { id: "B_WARN", severity: "warning", message: "varoitus", tool: "t" },
  { id: "C_ERR", severity: "error", message: "virhe" },
];

const report = (over: Partial<Report> = {}): Report => ({
  version: 1,
  target: "kohde",
  server: { name: "p", version: "1" },
  toolCount: 2,
  findings,
  smoke: [{ tool: "t", ok: true, ms: 7 }],
  summary: summarize(findings),
  ok: false,
  ...over,
});

describe("raportti", () => {
  it("laskee yhteenvedon vakavuuksittain", () => {
    expect(summarize(findings)).toEqual({ errors: 1, warnings: 1, infos: 1 });
  });

  it("tekstiraportti järjestää löydökset virhe, varoitus, huomio", () => {
    const text = formatText(report());
    expect(text.indexOf("C_ERR")).toBeLessThan(text.indexOf("B_WARN"));
    expect(text.indexOf("B_WARN")).toBeLessThan(text.indexOf("A_INFO"));
    expect(text).toContain("[B_WARN] t: varoitus");
    expect(text).toContain("Yhteenveto: 1 virhettä, 1 varoitusta, 1 huomiota -> EPÄONNISTUI");
    expect(text).toMatch(/OK\s+t \(7 ms\)/);
  });

  it("tekstiraportti kertoo, ettei palvelimen tietoja ole yhteysvirheessä", () => {
    expect(formatText(report({ server: null, toolCount: 0 }))).toContain("ei tietoja");
  });

  it("JSON on kelvollista ja sisältää version", () => {
    const parsed = JSON.parse(formatJson(report()));
    expect(parsed.version).toBe(1);
    expect(parsed.findings).toHaveLength(3);
  });
});
