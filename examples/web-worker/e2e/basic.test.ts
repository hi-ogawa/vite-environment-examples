import { expect, test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("worker-message")).toContainText(
    "Rendered in web worker",
  );
});

test("erorr stack", async ({ page }) => {
  // TODO:
  // playwright's error stack doesn't have sourcemap applied.
  // it needs to be manually verified from devtools console error message.
  const errorPromise = page.waitForEvent("pageerror");
  await page.goto("/?error");
  const error = await errorPromise;
  expect(error.message).toBe("test-error");
});

test("worker in worker", async ({ page }) => {
  await page.goto("/?worker-in-worker");
  await expect(page.getByTestId("worker-message")).toContainText(
    "Rendered in web worker in web worker",
  );
});