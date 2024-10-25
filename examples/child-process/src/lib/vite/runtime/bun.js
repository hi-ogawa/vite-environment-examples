import { createBridgeClient } from "../bridge-client.ts";

async function main() {
  // @ts-ignore
  const options = JSON.parse(process.argv[2]);
  const bridgeClient = createBridgeClient(options);
  const server = Bun.serve({ port: 0, fetch: bridgeClient.handler });
  const childOut = Bun.file(3).writer();
  childOut.write(
    JSON.stringify({ type: "register", port: server.port }) + "\n",
  );
}

main();
