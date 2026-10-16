// Testipalvelin: kertoo, onko annettu ympäristömuuttuja nähtävissä. Palauttaa virheen, jos muuttuja
// SALAINEN_ARVO vuotaa; muut muuttujat vain raportoidaan.
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "env-probe", version: "1.0.0" });
server.registerTool(
  "env",
  { description: "Kertoo onko ympäristömuuttuja asetettu.", inputSchema: { name: z.string().describe("Muuttujan nimi") } },
  async ({ name }) => {
    const set = process.env[name] !== undefined;
    if (name === "SALAINEN_ARVO" && set) return { isError: true, content: [{ type: "text", text: "VUOTO: salainen arvo näkyy palvelimelle" }] };
    if (name === "VALITETTU" && !set) return { isError: true, content: [{ type: "text", text: "--env ei välittänyt muuttujaa" }] };
    return { content: [{ type: "text", text: set ? "asetettu" : "ei asetettu" }] };
  },
);
await server.connect(new StdioServerTransport());
