// Testipalvelin: työkalu palauttaa virheen JSON-RPC-virheenä (-32602), ei isError-vastauksena.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "protokollavirhe", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "strict",
      description: "Heittää protokollatason virheen virheellisestä syötteestä.",
      inputSchema: { type: "object", properties: { x: { type: "string", description: "Pakollinen teksti" } }, required: ["x"] },
    },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async () => {
  throw new McpError(ErrorCode.InvalidParams, "x puuttuu");
});
await server.connect(new StdioServerTransport());
