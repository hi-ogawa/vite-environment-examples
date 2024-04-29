import { type Page, expect, test } from "@playwright/test";
import {
  createFileEditor,
  testNoJs,
  usePageErrorChecker,
  waitForHydration,
} from "./helper";

test("client-component", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await page.getByTestId("client-component").getByText("Count: 0").click();
  await page
    .getByTestId("client-component")
    .getByRole("button", { name: "+" })
    .click();
  await page.getByTestId("client-component").getByText("Count: 1").click();
});

test("server-action @js", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await testServerAction(page);
});

testNoJs("server-action @nojs", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await testServerAction(page);
});

async function testServerAction(page: Page) {
  await page.getByTestId("server-action").getByText("Count: 0").click();
  await page
    .getByTestId("server-action")
    .getByRole("button", { name: "+" })
    .click();
  await page.getByTestId("server-action").getByText("Count: 1").click();
  await page
    .getByTestId("server-action")
    .getByRole("button", { name: "-" })
    .click();
  await page.getByTestId("server-action").getByText("Count: 0").click();
}

test("useActionState @js", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await testUseActionState(page, { js: true });
});

testNoJs("useActionState @nojs", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await testUseActionState(page, { js: false });
});

async function testUseActionState(page: Page, options: { js: boolean }) {
  await page.getByPlaceholder("Answer?").fill("3");
  await page.getByPlaceholder("Answer?").press("Enter");
  if (options.js) {
    await expect(page.getByTestId("action-state")).toHaveText("...");
  }
  await page.getByText("Wrong! (tried once)").click();
  await expect(page.getByPlaceholder("Answer?")).toHaveValue(
    options.js ? "3" : "",
  );
  await page.getByPlaceholder("Answer?").fill("2");
  await page.getByPlaceholder("Answer?").press("Enter");
  await page.getByText("Correct! (tried 2 times)").click();
}

test("css basic @js", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await testCssBasic(page);
});

testNoJs("css basic @nojs", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await testCssBasic(page);
});

async function testCssBasic(page: Page) {
  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(220, 220, 255)");
  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 220, 220)");
}

test("css hmr server", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  await using serverCss = await createFileEditor("src/routes/_server.css");
  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(220, 220, 255)");
  await serverCss.edit((data) =>
    data.replace("rgb(220, 220, 255)", "rgb(199, 199, 255)"),
  );
  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(199, 199, 255)");
});

test("css hmr client @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  await using clientCss = await createFileEditor("src/routes/_client.css");
  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 220, 220)");
  await clientCss.edit((data) =>
    data.replace("rgb(255, 220, 220)", "rgb(255, 199, 199)"),
  );
  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 199, 199)");
});
