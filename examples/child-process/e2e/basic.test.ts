import { test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Bun.version").click();
});
