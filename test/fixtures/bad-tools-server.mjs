// Testipalvelin: toimiva kättely, mutta työkalujen määrittelyt ovat huonoja.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "huono-palvelin", version: "0.0.1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "dup", description: "Ensimmäinen kopio, kuvaus on riittävän pitkä.", inputSchema: { type: "object", properties: {} } },
    { name: "dup", description: "Toinen kopio, kuvaus on riittävän pitkä.", inputSchema: { type: "object", properties: {} } },
    { name: "no desc!", inputSchema: { type: "object", properties: {} } },
    {
      name: "loose",
      description: "Työkalu, jonka skeema on huono monella tavalla.",
      inputSchema: { type: "object", properties: { x: {}, y: { type: "string" } }, required: ["x", "z"] },
    },
  ],
}));
await server.connect(new StdioServerTransport());
