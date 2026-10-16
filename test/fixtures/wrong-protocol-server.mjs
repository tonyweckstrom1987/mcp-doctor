// Testipalvelin: vastaa initialize-pyyntöön tuntemattomalla protokollaversiolla.
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.method === "initialize") {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "1999-01-01", capabilities: {}, serverInfo: { name: "vanha", version: "0" } } }) + "\n",
    );
  }
});
