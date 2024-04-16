import type childProcess from "node:child_process";

export function createProcessHelper(
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
    const promise = new Promise<void>((resolve) => {
      const listener = () => {
        if (predicate(stdout)) {
          resolve();
          listeners.delete(listener);
        }
      };
      listeners.add(listener);
    });
    const timeout = sleep(5000).then(() => {
      throw new Error("waitFor timeout", { cause: stdout });
    });
    return Promise.race([promise, timeout]);
  }

  return {
    get stdout() {
      return stdout;
    },
    waitFor,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms).unref());
}
