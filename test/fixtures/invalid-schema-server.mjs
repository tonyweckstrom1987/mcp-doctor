// Testipalvelin: yksi työkalu rikkoo MCP:n Tool-skeeman (inputSchema.type ei ole "object"), muut ovat kunnossa.
// SDK:n listTools hylkää tällaisen vastauksen kokonaan, joten mcp-doctorin pitää silti lintata työkalut raakavastauksesta.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "rikkinainen-skeema", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "ok_tool", description: "Toimiva työkalu, jonka kuvaus on riittävän pitkä.", inputSchema: { type: "object", properties: {} } },
    { name: "string_schema", description: "Syöteskeeman tyyppi on väärin tässä työkalussa.", inputSchema: { type: "string" } },
    { name: "string_required", description: "Pakollisten kenttien lista on merkkijono.", inputSchema: { type: "object", properties: { q: { type: "string", description: "Hakusana" } }, required: "q" } },
    { name: "array_output", description: "Tulosskeema on taulukko eikä objekti.", inputSchema: { type: "object", properties: {} }, outputSchema: { type: "array" } },
    { description: "Nimetön työkalu.", inputSchema: { type: "object", properties: {} } },
  ],
}));
await server.connect(new StdioServerTransport());
