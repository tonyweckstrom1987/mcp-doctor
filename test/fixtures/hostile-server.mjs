// Testipalvelin: vihamielinen. Nimi, versio ja työkalun nimi sisältävät rivinvaihtoja ja terminaalin escape-sekvenssejä.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "paha\n::error::vaarennos", version: "1.0\x1b[2J" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "a\n::warning::x",
      description: "Työkalu, jonka nimessä on rivinvaihto ja työnkulkukomento.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));
await server.connect(new StdioServerTransport());
