// Testipalvelin: kunnossa oleva MCP-palvelin (stdio) muutamalla työkalulla.
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "hyva-palvelin", version: "1.2.3" });
const text = (t) => ({ content: [{ type: "text", text: t }] });

server.registerTool(
  "greet",
  { description: "Palauttaa tervehdyksen annetulle nimelle.", inputSchema: { name: z.string().describe("Tervehdittävän nimi") } },
  async ({ name }) => text(`Hei, ${name}!`),
);
server.registerTool(
  "always_fails",
  { description: "Palauttaa aina virheen (testaa odotettua virhettä).", inputSchema: {} },
  async () => ({ isError: true, content: [{ type: "text", text: "ei onnistu" }] }),
);
server.registerTool(
  "empty_result",
  { description: "Palauttaa tyhjän tuloksen (testaa varoitusta).", inputSchema: {} },
  async () => ({ content: [] }),
);
server.registerTool(
  "slow",
  { description: "Odottaa annetun ajan ennen vastaamista.", inputSchema: { ms: z.number().describe("Odotus millisekunteina") } },
  async ({ ms }) => {
    await new Promise((r) => setTimeout(r, ms));
    return text("valmis");
  },
);
server.registerTool(
  "add",
  {
    description: "Laskee kahden luvun summan ja palauttaa sen myös rakenteisena.",
    inputSchema: { a: z.number().describe("Ensimmäinen luku"), b: z.number().describe("Toinen luku") },
    outputSchema: { sum: z.number() },
  },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }], structuredContent: { sum: a + b } }),
);

await server.connect(new StdioServerTransport());
