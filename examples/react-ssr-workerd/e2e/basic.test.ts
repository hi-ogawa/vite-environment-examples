import { expect, test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toContainText("hydrated: true");
  await expect(page.locator("#root")).toContainText("Count: 0");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.locator("#root")).toContainText("Count: 1");

  await page.reload();
  await expect(page.locator("#root")).toContainText("hydrated: true");
  await expect(page.locator("#root")).toContainText("Count: 1");
  await page.getByRole("button", { name: "-" }).click();
  await expect(page.locator("#root")).toContainText("Count: 0");
});

test("server error stack", async ({ request }) => {
  const res = await request.get("/crash-ssr");
  expect(res.status()).toBe(500);

  let text = await res.text();
  text = text.replaceAll(/[/].*node_modules/gm, "__NODE_MODULES__");
  text = text.replaceAll(process.cwd(), "__CWD__");
  expect(text).toMatch(`\
Error: crash ssr
    at Module.crash (__CWD__/src/routes/crash-dep.ts:3:9)
    at CrashSsr (__CWD__/src/routes/crash.tsx:5:5)`);
});
