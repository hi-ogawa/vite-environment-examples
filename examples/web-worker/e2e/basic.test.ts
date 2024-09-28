import { expect, test } from "@playwright/test";

test("basic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("worker-message")).toContainText(
    "Rendered in web worker",
  );
});

test("erorr stack", async ({ page }) => {
  // TODO:
  // error event's stacktrace doesn't have sourcemap applied.
  // it needs to be verified from devtools console error message.
  const errorPromise = page.waitForEvent("pageerror");
  await page.goto("/?error-stack");
  const error = await errorPromise;
  expect(error.message).toBe("test-error-stack");
});
