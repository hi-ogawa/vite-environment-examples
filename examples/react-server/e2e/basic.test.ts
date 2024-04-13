import { test, type Page } from "@playwright/test";

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
