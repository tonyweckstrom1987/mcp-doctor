// Demopalvelin, versio "jälkeen": sama palvelin kuin ennen.mjs, viat korjattu.
// Ohje: docs/demo.md.
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "muistio-demo", version: "0.2.0" });
const notes = [];
const text = (t) => ({ content: [{ type: "text", text: t }] });

server.registerTool(
  "add_note",
  {
    description: "Adds a note with optional tags to the in-memory notebook.",
    inputSchema: {
      text: z.string().describe("The note text, one or more sentences"),
      tags: z.array(z.string()).describe("Short labels for grouping, e.g. ['school', 'math']"),
    },
  },
  async ({ text: t, tags }) => {
    notes.push({ id: notes.length + 1, text: t, tags });
    return text(`Lisätty muistiinpano ${notes.length}`);
  },
);

server.registerTool(
  "search_notes",
  {
    description: "Finds notes whose text contains the query (case-insensitive). Returns id and text per hit.",
    inputSchema: { query: z.string().describe("Word or phrase to look for in note texts") },
  },
  async ({ query }) => {
    const q = query.trim().toLowerCase();
    const hits = notes.filter((n) => n.text.toLowerCase().includes(q));
    return text(hits.map((n) => `${n.id}: ${n.text}`).join("\n") || "Ei osumia");
  },
);

server.registerTool(
  "delete_note",
  {
    description: "Deletes one note by its id. Cannot be undone.",
    inputSchema: { id: z.number().describe("Poistettavan muistiinpanon numero") },
  },
  async ({ id }) => {
    const i = notes.findIndex((n) => n.id === id);
    if (i < 0) return { isError: true, content: [{ type: "text", text: "Ei löydy" }] };
    notes.splice(i, 1);
    return text(`Poistettu ${id}`);
  },
);

await server.connect(new StdioServerTransport());
