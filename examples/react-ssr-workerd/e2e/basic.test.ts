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
  text = text.replaceAll(process.cwd(), "__CWD__");
  expect(text).toMatch(`\
Error: crash ssr
    at crashSsr (__CWD__/src/crash-ssr.ts:7:9)
    at handler (__CWD__/src/entry-server.tsx:15:5)`);
});

test("hot custom message", async ({ request }) => {
  const res = await request.get("/hot-custom");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ server: { runner: "ok" } });
});
