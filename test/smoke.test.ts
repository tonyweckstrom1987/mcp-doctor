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
    ["tuntematon kenttä", '[{"tool":"x","foo":1}]'],
  ])("hylkää: %s", (_nimi, text) => {
    expect(() => parseSmokeSpec(text)).toThrow(UsageError);
  });

  it.each([
    ["args", "arguments"],
    ["expect_error", "expectError"],
    ["maxms", "maxMs"],
  ])("kirjoitusvirhe %s ei ohitu hiljaa, vaan ehdottaa kenttää %s", (key, hint) => {
    const text = JSON.stringify([{ tool: "delete_note", [key]: key === "args" ? { id: 999 } : key === "maxms" ? 50 : true }]);
    expect(() => parseSmokeSpec(text)).toThrow(UsageError);
    expect(() => parseSmokeSpec(text)).toThrow(`calls[0]: tuntematon kenttä '${key}' (tarkoititko '${hint}'?)`);
  });

  it("tuntematon kenttä ilman ehdotusta listaa sallitut kentät", () => {
    expect(() => parseSmokeSpec('[{"tool":"x","comment":"testi"}]')).toThrow("sallitut: tool, arguments, expectError, maxMs");
  });
});
