// Demopalvelin, versio "ennen": pieni muistiinpanopalvelin, jossa on tyypillisiä vikoja.
// Käynnistyy ja vastaa kättelyyn normaalisti, joten MCP-asiakas ei kerro vioista mitään.
// Korjattu versio: jalkeen.mjs. Ohje: docs/demo.md.
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "muistio-demo", version: "0.1.0" });
const notes = [];
const text = (t) => ({ content: [{ type: "text", text: t }] });

server.registerTool(
  "add_note",
  {
    description: "Adds a note with optional tags to the in-memory notebook.",
    // Vika 1: kentiltä puuttuu kuvaus (.describe). Malli joutuu arvaamaan, mitä niihin laitetaan.
    inputSchema: { text: z.string(), tags: z.array(z.string()) },
  },
  async ({ text: t, tags }) => {
    notes.push({ id: notes.length + 1, text: t, tags });
    return text(`Lisätty muistiinpano ${notes.length}`);
  },
);

server.registerTool(
  "search_notes",
  {
    // Vika 2: kuvaus on liian lyhyt kertomaan, milloin työkalua kuuluu käyttää.
    description: "Search",
    // Vika 3: kentällä ei ole tyyppiä eikä kuvausta.
    inputSchema: { query: z.any() },
  },
  async ({ query }) => {
    // Vika 4: kirjoitusvirhe (toLowercase), joka kaatuu vasta oikeassa kutsussa.
    const q = String(query).trim().toLowercase();
    const hits = notes.filter((n) => n.text.toLowerCase().includes(q));
    return text(hits.map((n) => `${n.id}: ${n.text}`).join("\n") || "Ei osumia");
  },
);

server.registerTool(
  "delete_note",
  // Vika 5: kuvaus puuttuu kokonaan.
  { inputSchema: { id: z.number().describe("Poistettavan muistiinpanon numero") } },
  async ({ id }) => {
    const i = notes.findIndex((n) => n.id === id);
    if (i < 0) return { isError: true, content: [{ type: "text", text: "Ei löydy" }] };
    notes.splice(i, 1);
    return text(`Poistettu ${id}`);
  },
);

await server.connect(new StdioServerTransport());
