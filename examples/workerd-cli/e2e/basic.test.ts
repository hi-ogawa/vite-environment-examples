import childProcess from "node:child_process";
import test from "node:test";
import { createProcessHelper } from "./helper";

test("basic", async () => {
  using proc = childProcess.spawn("pnpm", ["-s", "cli"]);
  const helper = createProcessHelper(proc);
  await helper.waitFor((out) => out.includes("[mf:inf] Ready"));
  proc.stdin.write(`env.kv\n`);
  await helper.waitFor((out) => out.includes("KvNamespace {}"));
  proc.stdin.write(`env.kv.list()\n`);
  await helper.waitFor((out) => out.includes("{ keys: []"));
  proc.stdin.write(`(await import("/package.json")).name\n`);
  await helper.waitFor((out) =>
    out.includes("@hiogawa/vite-environment-examples-workerd-cli"),
  );
});
