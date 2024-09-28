import childProcess from "node:child_process";
import test from "node:test";
import { createProcessHelper } from "../../workerd-cli/e2e/helper";

test("basic", async () => {
  using proc = childProcess.spawn("pnpm", ["-s", "cli"]);
  const helper = createProcessHelper(proc);
  await helper.waitFor((out) => out.includes("> "));
  proc.stdin.write(
    `(await import("react-dom/client")).createRoot(document.body).render(<div>yay</div>)\n`,
  );
  await helper.waitFor((out) => out.includes(`undefined`));
  proc.stdin.write("document.body.innerHTML\n");
  await helper.waitFor((out) => out.includes(`<div>yay</div>`));
});
