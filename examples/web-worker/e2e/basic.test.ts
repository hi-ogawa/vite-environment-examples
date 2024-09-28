import { expect, test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("worker-message")).toContainText(
    "Rendered in web worker",
  );
});
