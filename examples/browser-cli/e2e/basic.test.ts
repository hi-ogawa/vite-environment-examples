import test from "node:test";
import childProcess from "node:child_process";
import { createProcessHelper } from "../../workerd-cli/e2e/helper";

test("basic", async () => {
  using proc = childProcess.spawn("pnpm", ["-s", "cli"]);
  const helper = createProcessHelper(proc);
  await helper.waitFor((out) => out.includes("> "));
  const code = [
    `const ReactDom = await import("react-dom");`,
    `ReactDom.render(<div style={{ color: "red" }}>yay</div>, document.body);`,
    `document.body.innerHTML;`,
  ].join("");
  proc.stdin.write(code + "\n");
  await helper.waitFor((out) =>
    out.includes(`> <div style="color: red;">yay</div>`),
  );
});
