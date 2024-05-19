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
      // use it on https://evanw.github.io/source-map-visualization
      // example https://evanw.github.io/source-map-visualization/#MTE1NgAKbGV0IGNvdW50NCA9IDA7CgpmdW5jdGlvbiBDb3VudGVyNCgpIHsKICBjb25zdCBuYW1lID0gInZhbHVlIi5zbGljZSgpOwoKICBjb25zdCBjaGFuZ2VDb3VudDQgPSAkJGxpZnRfQ291bnRlcjRfY2hhbmdlQ291bnQ0LmJpbmQobnVsbCwgbmFtZSkKCiAgY29uc29sZS5sb2cobmFtZSwgY2hhbmdlQ291bnQ0KTsKfQphc3luYyBmdW5jdGlvbiAkJGxpZnRfQ291bnRlcjRfY2hhbmdlQ291bnQ0KG5hbWUsIGZvcm1EYXRhKXsKICAgICJ1c2Ugc2VydmVyIjsKICAgIGNvdW50NCArPSBOdW1iZXIoZm9ybURhdGEuZ2V0KG5hbWUpKTsKICB9CjsKaW1wb3J0IHsgcmVnaXN0ZXJTZXJ2ZXJSZWZlcmVuY2UgYXMgJCRyZWdpc3RlciB9IGZyb20gIi9zcmMvZmVhdHVyZXMvc2VydmVyLWFjdGlvbi9zZXJ2ZXIiOwokJGxpZnRfQ291bnRlcjRfY2hhbmdlQ291bnQ0ID0gJCRyZWdpc3RlcigkJGxpZnRfQ291bnRlcjRfY2hhbmdlQ291bnQ0LCAiPGlkPiIsICIkJGxpZnRfQ291bnRlcjRfY2hhbmdlQ291bnQ0Iik7CmV4cG9ydCB7ICQkbGlmdF9Db3VudGVyNF9jaGFuZ2VDb3VudDQgfTsKCgovLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJaUpkTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lKY2JteGxkQ0JqYjNWdWREUWdQU0F3TzF4dVhHNW1kVzVqZEdsdmJpQkRiM1Z1ZEdWeU5DZ3BJSHRjYmlBZ1kyOXVjM1FnYm1GdFpTQTlJRndpZG1Gc2RXVmNJaTV6YkdsalpTZ3BPMXh1WEc0Z0lHRnplVzVqSUdaMWJtTjBhVzl1SUdOb1lXNW5aVU52ZFc1ME5DaG1iM0p0UkdGMFlTa2dlMXh1SUNBZ0lGd2lkWE5sSUhObGNuWmxjbHdpTzF4dUlDQWdJR052ZFc1ME5DQXJQU0JPZFcxaVpYSW9abTl5YlVSaGRHRXVaMlYwS0c1aGJXVXBLVHRjYmlBZ2ZWeHVYRzRnSUdOdmJuTnZiR1V1Ykc5bktHNWhiV1VzSUdOb1lXNW5aVU52ZFc1ME5DazdYRzU5WEc0aVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWtGQlFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEVzYjBWQlIwYzdRVUZEU0R0QlFVTkJPMEZCUTBFN1FVRk9SU3hsUVVGbExEUkNRVUZaTEdkQ1FVRlhPMEZCUTNoRE8wRkJRMEU3UVVGRFFTSjkKNDAyAHsidmVyc2lvbiI6Mywic291cmNlcyI6WyIiXSwic291cmNlc0NvbnRlbnQiOlsiXG5sZXQgY291bnQ0ID0gMDtcblxuZnVuY3Rpb24gQ291bnRlcjQoKSB7XG4gIGNvbnN0IG5hbWUgPSBcInZhbHVlXCIuc2xpY2UoKTtcblxuICBhc3luYyBmdW5jdGlvbiBjaGFuZ2VDb3VudDQoZm9ybURhdGEpIHtcbiAgICBcInVzZSBzZXJ2ZXJcIjtcbiAgICBjb3VudDQgKz0gTnVtYmVyKGZvcm1EYXRhLmdldChuYW1lKSk7XG4gIH1cblxuICBjb25zb2xlLmxvZyhuYW1lLCBjaGFuZ2VDb3VudDQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9FQUdHO0FBQ0g7QUFDQTtBQUNBO0FBTkUsZUFBZSw0QkFBWSxnQkFBVztBQUN4QztBQUNBO0FBQ0EifQ==
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
