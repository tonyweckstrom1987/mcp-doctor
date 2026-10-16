// Testipalvelin, jonka käyttäytyminen valitaan ensimmäisellä argumentilla:
// nocaps | noname | empty | listfails | paged | infinite | nooutput
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const mode = process.argv[2];
const schema = { type: "object", properties: {} };
const tool = (name) => ({ name, description: `Testityökalu nimeltä ${name}.`, inputSchema: schema });

const caps = mode === "nocaps" ? {} : { tools: {} };
const server = new Server({ name: mode === "noname" ? "" : "variantti", version: "1.0.0" }, { capabilities: caps });

if (mode !== "nocaps") {
  server.setRequestHandler(ListToolsRequestSchema, async (req) => {
    const cursor = req.params?.cursor;
    switch (mode) {
      case "empty":
        return { tools: [] };
      case "listfails":
        throw new Error("lista hajosi");
      case "paged":
        return cursor === "p2" ? { tools: [tool("toinen")] } : { tools: [tool("eka")], nextCursor: "p2" };
      case "infinite":
        return { tools: [tool(`t${cursor ?? "0"}`)], nextCursor: String(Number(cursor ?? "0") + 1) };
      case "nooutput":
        return { tools: [{ ...tool("rakenne"), outputSchema: { type: "object", properties: { x: { type: "number" } } } }] };
      default:
        return { tools: [tool("yksi")] };
    }
  });
  server.setRequestHandler(CallToolRequestSchema, async () => ({ content: [{ type: "text", text: "ok" }] }));
}
await server.connect(new StdioServerTransport());
