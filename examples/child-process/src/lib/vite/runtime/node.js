import assert from "node:assert";
import http from "node:http";
import { webToNodeHandler } from "@hiogawa/utils-node";
import { createBridgeClient } from "../bridge-client.js";

async function main() {
  // @ts-ignore
  const options = JSON.parse(process.argv[2]);
  const bridgeClient = createBridgeClient(options);

  const listener = webToNodeHandler(bridgeClient.handler);

  const server = http.createServer((req, res) => {
    listener(req, res, (e) => console.error(e));
  });

  server.listen(async () => {
    const address = server.address();
    assert(address && typeof address !== "string");
    await bridgeClient.rpc("register", `http://localhost:${address.port}`);
  });
}

main();
