import { dirname } from "path";
import { hashString } from "@hiogawa/utils";
import { mkdir, writeFile } from "fs/promises";
import type MagicString from "magic-string";
import { describe, expect, it } from "vitest";
import { transformServerAction2 } from "./plugin";

function inlineSourceMap(output: MagicString) {
  const code = output.toString();
  const map = output.generateMap({ includeContent: true });
  const encoded = Buffer.from(JSON.stringify(map), "utf-8").toString("base64");
  return `${code}\n\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}\n`;
}

describe(transformServerAction2, () => {
  async function testTransform(input: string) {
    const output = await transformServerAction2(input, "<id>");
    if (output && process.env["DEBUG_SOURCEMAP"]) {
      // open it on https://evanw.github.io/source-map-visualization
      const filepath = `dist/debug-sourcemap/${hashString(input)}.js`;
      await mkdir(dirname(filepath), { recursive: true });
      await writeFile(filepath, inlineSourceMap(output));
    }
    return output?.toString();
  }

  it("top level", async () => {
    const input = `
async function f() {
  "use server";
}
async function g() {
}
`;
    expect(await testTransform(input)).toMatchSnapshot();
  });

  it("closure", async () => {
    const input = `
let count4 = 0;

function Counter4() {
  const name = "value".slice();

  async function changeCount4(formData) {
    "use server";
    count4 += Number(formData.get(name));
  }

  console.log(name, changeCount4);
}
`;
    expect(await testTransform(input)).toMatchSnapshot();
  });
});
