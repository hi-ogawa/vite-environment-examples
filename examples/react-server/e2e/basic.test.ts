import { type Page, expect, test } from "@playwright/test";
import {
  createEditor,
  createReloadChecker,
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

test("client hmr @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using editor = createEditor("src/routes/_client.tsx");
  await using _ = await createReloadChecker(page);

  await page.getByRole("heading", { name: "Hello Client Component" }).click();
  editor.edit((s) =>
    s.replace("Hello Client Component", "Hello [EDIT] Client Component"),
  );
  await page
    .getByRole("heading", { name: "Hello [EDIT] Client Component" })
    .click();
});

test("server hmr @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using editor = createEditor("src/routes/page.tsx");
  await using _ = await createReloadChecker(page);

  await page.getByRole("heading", { name: "Hello Server Component" }).click();
  editor.edit((s) =>
    s.replace("Hello Server Component", "Hello [EDIT] Server Component"),
  );
  await page
    .getByRole("heading", { name: "Hello [EDIT] Server Component" })
    .click();
});

test("shared hmr @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using editor = createEditor("src/routes/_shared.tsx");
  await using _ = await createReloadChecker(page);

  await page.getByText("Shared Component (server)").click();
  await page.getByText("Shared Component (client)").click();
  editor.edit((s) => s.replace("Shared Component", "Shared [EDIT] Component"));
  await page.getByText("Shared [EDIT] Component (server)").click();
  await page.getByText("Shared [EDIT] Component (client)").click();
});

test("server action @js", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await testServerAction(page);
});

testNoJs("server action @nojs", async ({ page }) => {
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
  await expect(page.getByPlaceholder("Answer?")).toHaveValue("3");
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

test("css hmr server @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using editor = createEditor("src/routes/_server.css");
  await using _ = await createReloadChecker(page);

  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(220, 220, 255)");
  editor.edit((s) => s.replace("rgb(220, 220, 255)", "rgb(199, 199, 255)"));
  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(199, 199, 255)");
  editor.edit((s) => s.replace("rgb(199, 199, 255)", "rgb(123, 123, 255)"));
  await expect(
    page.getByTestId("server-action").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(123, 123, 255)");
});

test("css hmr client @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using editor = createEditor("src/routes/_client.css");
  await using _ = await createReloadChecker(page);

  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 220, 220)");
  editor.edit((s) => s.replace("rgb(255, 220, 220)", "rgb(255, 199, 199)"));
  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 199, 199)");
  editor.edit((s) => s.replace("rgb(255, 199, 199)", "rgb(255, 123, 123)"));
  await expect(
    page.getByTestId("client-component").getByRole("button", { name: "+" }),
  ).toHaveCSS("background-color", "rgb(255, 123, 123)");
});

test("unocss basic @js", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);
  await testUnocssBasic(page);
});

testNoJs("unocss basic @nojs @build", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await testUnocssBasic(page);
});

async function testUnocssBasic(page: Page) {
  await expect(page.getByText("unocss (server)")).toHaveCSS(
    "background-color",
    "rgb(220, 220, 255)",
  );
  await expect(page.getByText("unocss (client)")).toHaveCSS(
    "background-color",
    "rgb(255, 220, 220)",
  );
}

test("unocss hmr @dev", async ({ page }) => {
  usePageErrorChecker(page);
  await page.goto("/");
  await waitForHydration(page);

  using serverFile = createEditor("src/routes/page.tsx");
  using clientFile = createEditor("src/routes/_client.tsx");
  await using _ = await createReloadChecker(page);

  await expect(page.getByText("unocss (server)")).toHaveCSS(
    "background-color",
    "rgb(220, 220, 255)",
  );
  serverFile.edit((s) => s.replace("rgb(220,220,255)", "rgb(199,199,255)"));
  await expect(page.getByText("unocss (server)")).toHaveCSS(
    "background-color",
    "rgb(199, 199, 255)",
  );

  await expect(page.getByText("unocss (client)")).toHaveCSS(
    "background-color",
    "rgb(255, 220, 220)",
  );
  clientFile.edit((s) => s.replace("rgb(255,220,220)", "rgb(255,199,199)"));
  await expect(page.getByText("unocss (client)")).toHaveCSS(
    "background-color",
    "rgb(255, 199, 199)",
  );
});
