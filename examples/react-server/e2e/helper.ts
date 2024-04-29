import fs from "fs";
import { type Page, expect, test } from "@playwright/test";

export const testNoJs = test.extend({
  javaScriptEnabled: ({}, use) => use(false),
});

const pageErrorsMap = new WeakMap<Page, Error[]>();

test.afterEach(({ page }) => {
  const errors = pageErrorsMap.get(page);
  if (errors) {
    expect(errors).toEqual([]);
  }
});

export function useNoPageErrorChecker(page: Page) {
  const pageErrors: Error[] = [];
  pageErrorsMap.set(page, pageErrors);
  page.on("pageerror", (e) => pageErrors.push(e));
}

export async function createEditor(filepath: string) {
  let init = await fs.promises.readFile(filepath, "utf-8");
  let data = init;
  return {
    async edit(editFn: (data: string) => Promise<string> | string) {
      data = await editFn(data);
      await fs.promises.writeFile(filepath, data);
    },
    async [Symbol.asyncDispose]() {
      await fs.promises.writeFile(filepath, init);
    },
  };
}

export async function createNoReloadChecker(page: Page) {
  async function reset() {
    await page.evaluate(() => {
      const el = document.createElement("meta");
      el.setAttribute("name", "x-reload-check");
      document.head.append(el);
    });
  }

  async function check() {
    await expect(page.locator(`meta[name="x-reload-check"]`)).toBeAttached({
      timeout: 1,
    });
  }

  await reset();

  return {
    check,
    reset,
    [Symbol.asyncDispose]: check,
  };
}

export async function waitForHydration(page: Page) {
  await page.getByText("hydrated: true").click();
}
