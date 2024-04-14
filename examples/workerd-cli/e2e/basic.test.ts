import test from "node:test";
import childProcess from "node:child_process";

test("basic", async () => {
  using proc = childProcess.spawn("pnpm", ["cli"]);
  const helper = createProcessHelper(proc);
  await helper.waitFor((out) => out.includes("[mf:inf] Ready"));
  proc.stdin.write(`env\n`);
  await helper.waitFor((out) => out.includes("{ kv: KvNamespace {} }"));
  proc.stdin.write(`env.kv.list()\n`);
  await helper.waitFor((out) => out.includes("{ keys: []"));
});

function createProcessHelper(
  proc: childProcess.ChildProcessWithoutNullStreams,
) {
  let stdout = "";
  const listeners = new Set<() => void>();
  proc.stdout.on("data", (data) => {
    stdout += String(data);
    for (const f of listeners) {
      f();
    }
  });

  async function waitFor(predicate: (stdout: string) => boolean) {
    return new Promise<void>((resolve) => {
      const listener = () => {
        if (predicate(stdout)) {
          resolve();
          listeners.delete(listener);
        }
      };
      listeners.add(listener);
    });
  }

  return {
    get stdout() {
      return stdout;
    },
    waitFor,
  };
}
