import { test, expect } from "@playwright/test";

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

test("server action", async ({ page }) => {
  const res1 = await page.goto("/");
  expect(await res1?.text()).toContain("mounted: 0");

  // server counter
  await page.getByText("mounted: 1").click();
  await page.getByRole("link", { name: "Counter (server)" }).click();
  await page.waitForURL("/server");
  await page.getByText("Server Counter: 0").click();
  await page.getByRole("button", { name: "+" }).click();
  await page.getByText("Server Counter: 1").click();

  // reload
  const res2 = await page.reload();
  expect(await res2?.text()).toContain("Server Counter: 1");
  await page.getByText("mounted: 1").click();
  await page.getByRole("button", { name: "-" }).click();
  await page.getByText("Server Counter: 0").click();
});
