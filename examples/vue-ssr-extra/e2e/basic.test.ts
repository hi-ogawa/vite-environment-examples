import { type Page, expect, test } from "@playwright/test";

test("basic", async ({ page }) => {
  const res = await page.goto("/");
  expect(await res?.text()).toContain("mounted: 0");

  // client counter
  await page.getByText("mounted: 1").click();
  await page.getByRole("link", { name: "Counter (client)" }).click();
  await page.waitForURL("/client");

  await page.getByText("Client Counter: 0").click();
  await page.getByRole("button", { name: "+" }).click();
  await page.getByText("Client Counter: 1").click();
  await page.getByRole("button", { name: "-" }).click();
  await page.getByText("Client Counter: 0").click();
});

test("server action @js", async ({ page }) => {
  await page.goto("/");
  await page.getByText("mounted: 1").click();
  await page.getByRole("link", { name: "Counter (server)" }).click();
  await page.waitForURL("/server");
  await testServerAction(page);
});

test("server action @nojs", async ({ browser }) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto("/server");
  await testServerAction(page);
});

async function testServerAction(page: Page) {
  await page.getByText("Server Counter: 0").click();
  await page.getByRole("button", { name: "+" }).click();
  await page.getByText("Server Counter: 1").click();

  // reload
  const res2 = await page.reload();
  expect(await res2?.text()).toContain("Server Counter: 1");
  await page.getByRole("button", { name: "-" }).click();
  await page.getByText("Server Counter: 0").click();
}
