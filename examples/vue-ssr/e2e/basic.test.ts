import { test, expect } from "@playwright/test";

test("basic", async ({ page }) => {
  const res = await page.goto("/");
  expect(await res?.text()).toContain("hydrated: false");
  await expect(page.locator("#root")).toContainText("hydrated: true");
  await expect(page.locator("#root")).toContainText("Count: 0");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.locator("#root")).toContainText("Count: 1");
});
