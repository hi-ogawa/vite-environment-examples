import { createBridgeClient } from "../bridge-client.js";

async function main() {
  // @ts-ignore
  const options = JSON.parse(process.argv[2]);
  const bridgeClient = createBridgeClient(options);
  const server = Bun.serve({ port: 0, fetch: bridgeClient.handler });
  await bridgeClient.rpc("register", `http://localhost:${server.port}`);
}

main();
