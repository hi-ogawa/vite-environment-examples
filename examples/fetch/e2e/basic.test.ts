import { test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await page.pause();
  await page.getByText("hello").click();
});
