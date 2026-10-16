import { readFileSync } from "node:fs";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { diagnose } from "../src/runner.js";
import { VERSIO } from "../src/versio.js";
import { NODE, fixture, makeIo } from "./helpers.js";

const paketti = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

describe("versio", () => {
  it("VERSIO tulee package.json:sta", () => {
    expect(VERSIO).toBe(paketti.version);
    expect(VERSIO).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("asiakas ilmoittaa palvelimelle oikean version (ei kovakoodattua)", async () => {
    const palvelin = new McpServer({ name: "kuuntelija", version: "9.9.9" });
    palvelin.registerTool("x", { description: "Tekee jotain hyödyllistä testissä." }, async () => ({ content: [{ type: "text", text: "ok" }] }));
    const [asiakasPuoli, palvelinPuoli] = InMemoryTransport.createLinkedPair();
    await palvelin.connect(palvelinPuoli);
    await diagnose({ transport: asiakasPuoli, target: "muisti", timeoutMs: 5000, strict: false });
    expect(palvelin.server.getClientVersion()).toEqual({ name: "mcp-doctor", version: paketti.version });
  });

  it("--version tulostaa version ja palauttaa 0", async () => {
    const io = makeIo();
    expect(await main(["--version"], io)).toBe(0);
    expect(io.out.trim()).toBe(paketti.version);
  });

  it("palvelimen oma --help tai --version erottimen jälkeen ei laukaise meidän ohjettamme", async () => {
    for (const lippu of ["--help", "--version"]) {
      const io = makeIo();
      const koodi = await main(["--", NODE, fixture("good-server.mjs"), lippu], io);
      expect(koodi).toBe(0);
      expect(io.out).not.toContain("Käyttö:");
      expect(io.out).toContain("Palvelin: hyva-palvelin");
    }
  });
});
