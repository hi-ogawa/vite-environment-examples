import { expect, test } from "@playwright/test";
import { createEditor } from "./helper";

test("basic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("worker")).toContainText(
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
  await expect(page.getByTestId("worker")).toContainText(
    "Rendered in web worker in web worker",
  );
});

test("reload worker change @dev", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("worker-message")).toContainText("dep-ok");
  using file = createEditor("./src/worker/dep.tsx");
  file.edit((s) => s.replace(`"dep-ok"`, `"dep-edit-ok"`));
  await expect(page.getByTestId("worker-message")).toContainText("dep-edit-ok");
});

test("condition", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("client")).toContainText(
    "test-dep-conditions: index.browser.js",
  );
  await expect(page.getByTestId("worker")).toContainText(
    "test-dep-conditions: index.worker.js",
  );
});
