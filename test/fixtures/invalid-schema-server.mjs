// Testipalvelin: työkalu rikkoo MCP:n Tool-skeeman. SDK:n listTools hylkää tällaisen vastauksen kokonaan,
// joten mcp-doctorin pitää lintata työkalut raakavastauksesta. Tila argumenttina:
//   (oletus) yksi sivu, jossa kunnossa oleva ja rikkinäisiä työkaluja
//   page2    kolme sivua, rikkinäinen työkalu vasta sivulla 2
//   rawfails ensimmäinen vastaus rikkoo skeemaa, toinen kutsu (raakahaku) heittää virheen
//   listfails käsittelijä heittää aina (JSON-RPC-virhe, ei saa johtaa raakahakuun)
//   slow     kuten oletus, mutta jokainen vastaus viivästyy 600 ms (kokonaisaikaraja)
//   badajv   outputSchema on kelvoton JSON Schema (SDK:n ajv-käännös kaatuu, ei zod-virhe)
// Jokainen tools/list-kutsu kirjoittaa stderriin rivin "LIST", jotta testi voi laskea kutsut.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const mode = process.argv[2] ?? "default";
const ok = (name) => ({ name, description: "Toimiva työkalu, jonka kuvaus on riittävän pitkä.", inputSchema: { type: "object", properties: {} } });
const stringSchema = { name: "string_schema", description: "Syöteskeeman tyyppi on väärin tässä työkalussa.", inputSchema: { type: "string" } };
let calls = 0;

const server = new Server({ name: "rikkinainen-skeema", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async (req) => {
  calls++;
  process.stderr.write("LIST\n");
  if (mode === "slow") await new Promise((r) => setTimeout(r, 600));
  if (mode === "listfails") throw new Error("lista hajosi");
  if (mode === "rawfails" && calls > 1) throw new Error("raakahaku hajosi");
  if (mode === "badajv") {
    return { tools: [ok("ok_tool"), { ...ok("bad_output"), outputSchema: { type: "object", properties: { a: { type: "foo" } } } }] };
  }
  if (mode === "page2") {
    const cursor = req.params?.cursor;
    if (!cursor) return { tools: [ok("p1_tool")], nextCursor: "s2" };
    if (cursor === "s2") return { tools: [stringSchema], nextCursor: "s3" };
    return { tools: [ok("p3_tool")] };
  }
  return {
    tools: [
      ok("ok_tool"),
      stringSchema,
      { name: "string_required", description: "Pakollisten kenttien lista on merkkijono.", inputSchema: { type: "object", properties: { q: { type: "string", description: "Hakusana" } }, required: "q" } },
      { name: "array_output", description: "Tulosskeema on taulukko eikä objekti.", inputSchema: { type: "object", properties: {} }, outputSchema: { type: "array" } },
      { description: "Nimetön työkalu.", inputSchema: { type: "object", properties: {} } },
    ],
  };
});
await server.connect(new StdioServerTransport());
