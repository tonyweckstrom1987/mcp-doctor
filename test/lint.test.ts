import { describe, expect, it } from "vitest";
import { lintTools } from "../src/lint.js";

const okSchema = { type: "object", properties: { a: { type: "string", description: "kuvaus" } }, required: ["a"] };
const good = { name: "hyva", description: "Riittävän pitkä kuvaus työkalulle.", inputSchema: okSchema };

const ids = (tools: Parameters<typeof lintTools>[0]) => lintTools(tools).map((f) => f.id);

describe("lintTools", () => {
  it("kunnossa oleva työkalu ei anna löydöksiä", () => {
    expect(lintTools([good])).toEqual([]);
  });

  it("raportoi päällekkäiset nimet kerran ja virheenä", () => {
    const f = lintTools([good, good]);
    expect(f.filter((x) => x.id === "TOOL_DUPLICATE")).toHaveLength(1);
    expect(f.find((x) => x.id === "TOOL_DUPLICATE")?.severity).toBe("error");
    expect(f).toHaveLength(1); // duplikaatin skeemaa ei tarkisteta kahdesti
  });

  it("duplikaatin muut löydökset raportoidaan vain kerran", () => {
    const bad = { name: "x", inputSchema: okSchema }; // kuvaus puuttuu
    const f = lintTools([bad, bad]);
    expect(f.filter((x) => x.id === "TOOL_DESC_MISSING")).toHaveLength(1);
    expect(f.filter((x) => x.id === "TOOL_DUPLICATE")).toHaveLength(1);
  });

  it("nimi: virhe kielletyistä merkeistä, varoitus pisteestä tai yli 64 merkistä", () => {
    expect(lintTools([{ ...good, name: "a b" }]).find((x) => x.id === "TOOL_NAME_INVALID")?.severity).toBe("error");
    expect(lintTools([{ ...good, name: "" }]).find((x) => x.id === "TOOL_NAME_INVALID")).toBeDefined();
    expect(lintTools([{ ...good, name: "a".repeat(129) }]).find((x) => x.id === "TOOL_NAME_INVALID")).toBeDefined();
    expect(lintTools([{ ...good, name: "a.b" }]).find((x) => x.id === "TOOL_NAME_PORTABILITY")?.severity).toBe("warning");
    expect(lintTools([{ ...good, name: "a".repeat(65) }]).find((x) => x.id === "TOOL_NAME_PORTABILITY")).toBeDefined();
    expect(ids([{ ...good, name: "a".repeat(64) }])).toEqual([]);
  });

  it("kuvaus: puuttuva ja tyhjä on varoitus, lyhyt on huomio", () => {
    expect(lintTools([{ name: "x", inputSchema: okSchema }]).find((f) => f.id === "TOOL_DESC_MISSING")?.severity).toBe("warning");
    expect(ids([{ name: "x", description: "   ", inputSchema: okSchema }])).toContain("TOOL_DESC_MISSING");
    expect(lintTools([{ name: "x", description: "lyhyt", inputSchema: okSchema }]).find((f) => f.id === "TOOL_DESC_SHORT")?.severity).toBe("info");
  });

  it("syöteskeema: puuttuva tai muu kuin object on virhe", () => {
    expect(ids([{ ...good, inputSchema: undefined }])).toContain("SCHEMA_NOT_OBJECT");
    expect(ids([{ ...good, inputSchema: { type: "string" } }])).toContain("SCHEMA_NOT_OBJECT");
  });

  it("required: tuntematon kenttä ja väärä muoto ovat virheitä", () => {
    const unknown = lintTools([{ ...good, inputSchema: { type: "object", properties: {}, required: ["puuttuu"] } }]);
    expect(unknown.find((f) => f.id === "SCHEMA_REQUIRED_UNKNOWN")?.message).toContain("puuttuu");
    expect(ids([{ ...good, inputSchema: { type: "object", required: ["x"] } }])).toContain("SCHEMA_REQUIRED_UNKNOWN");
    expect(ids([{ ...good, inputSchema: { type: "object", properties: {}, required: "x" } }])).toContain("SCHEMA_REQUIRED_INVALID");
    expect(ids([{ ...good, inputSchema: { type: "object", properties: {}, required: [1] } }])).toContain("SCHEMA_REQUIRED_INVALID");
  });

  it("kenttä: puuttuva kuvaus ja tyyppi ovat varoituksia", () => {
    const f = lintTools([{ ...good, inputSchema: { type: "object", properties: { x: {}, y: { type: "string" }, z: { type: "string", description: " " } } } }]);
    expect(f.filter((x) => x.id === "SCHEMA_PROP_UNTYPED")).toHaveLength(1);
    expect(f.filter((x) => x.id === "SCHEMA_PROP_DESC_MISSING")).toHaveLength(3);
    expect(f.every((x) => x.severity === "warning")).toBe(true);
  });

  it("anyOf/enum/$ref riittävät tyypiksi", () => {
    const props = { a: { anyOf: [{ type: "string" }], description: "k" }, b: { enum: [1, 2], description: "k" }, c: { $ref: "#/x", description: "k" } };
    expect(lintTools([{ ...good, inputSchema: { type: "object", properties: props } }])).toEqual([]);
  });

  it("tulosskeema: väärä tyyppi on virhe, kunnollinen ei anna löydöksiä", () => {
    expect(ids([{ ...good, outputSchema: { type: "array" } }])).toContain("OUTPUT_SCHEMA_NOT_OBJECT");
    expect(lintTools([{ ...good, outputSchema: { type: "object", properties: { sum: { type: "number" } } } }])).toEqual([]);
  });
});
