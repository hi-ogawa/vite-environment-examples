import { describe, expect, it } from "vitest";
import { transformServerAction2 } from "./plugin";

describe(transformServerAction2, () => {
  async function testTransform(input: string) {
    const output = await transformServerAction2(input, "<id>");
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
