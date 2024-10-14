import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import { Writable } from "node:stream";
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

  const childOutput = new Writable({
    write(chunk, _encoding, callback) {
      fs.write(3, chunk, callback);
    },
  });

  server.listen(async () => {
    const address = server.address();
    assert(address && typeof address !== "string");
    childOutput.write(JSON.stringify({ port: address.port }) + "\n");
  });
}

main();
