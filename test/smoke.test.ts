import { describe, expect, it } from "vitest";
import { parseSmokeSpec, DEFAULT_MAX_MS } from "../src/smoke.js";
import { UsageError } from "../src/types.js";

describe("parseSmokeSpec", () => {
  it("lukee calls-objektin ja täyttää oletukset", () => {
    expect(parseSmokeSpec('{"calls":[{"tool":"greet","arguments":{"name":"Tony"}}]}')).toEqual([
      { tool: "greet", arguments: { name: "Tony" }, expectError: false, maxMs: DEFAULT_MAX_MS },
    ]);
  });

  it("hyväksyy pelkän taulukon ja puuttuvat arguments-kentän", () => {
    expect(parseSmokeSpec('[{"tool":"x","expectError":true,"maxMs":50}]')).toEqual([{ tool: "x", arguments: {}, expectError: true, maxMs: 50 }]);
  });

  it.each([
    ["rikkinäinen JSON", "{"],
    ["ei taulukkoa", '{"foo":1}'],
    ["alkio ei objekti", "[1]"],
    ["tool puuttuu", '[{"arguments":{}}]'],
    ["tool tyhjä", '[{"tool":""}]'],
    ["arguments taulukko", '[{"tool":"x","arguments":[]}]'],
    ["expectError väärä tyyppi", '[{"tool":"x","expectError":"kyllä"}]'],
    ["maxMs nolla", '[{"tool":"x","maxMs":0}]'],
    ["maxMs merkkijono", '[{"tool":"x","maxMs":"5"}]'],
    ["tyhjä taulukko", "[]"],
    ["tyhjä calls", '{"calls":[]}'],
  ])("hylkää: %s", (_nimi, text) => {
    expect(() => parseSmokeSpec(text)).toThrow(UsageError);
  });
});
