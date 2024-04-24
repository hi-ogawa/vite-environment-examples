import { test, type Page, expect } from "@playwright/test";

test("client-component", async ({ page }) => {
  await page.goto("/");
  await page.getByText("hydrated: true").click();
  await page.getByTestId("client-component").getByText("Count: 0").click();
  await page
    .getByTestId("client-component")
    .getByRole("button", { name: "+" })
    .click();
  await page.getByTestId("client-component").getByText("Count: 1").click();
});

test("server-action @js", async ({ page }) => {
  await page.goto("/");
  await page.getByText("hydrated: true").click();
  await testServerAction(page);
});

test("server-action @nojs", async ({ browser }) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
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
  await page.goto("/");
  await page.getByText("hydrated: true").click();
  await testUseActionState(page, { js: true });
});

test("useActionState @nojs", async ({ browser }) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
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
