import fs from "fs";
import { sleep } from "@hiogawa/utils";
import { type Page, type Request, expect, test } from "@playwright/test";

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

export function usePageErrorChecker(page: Page) {
  const pageErrors: Error[] = [];
  pageErrorsMap.set(page, pageErrors);
  page.on("pageerror", (e) => pageErrors.push(e));
}

export function createEditor(filepath: string) {
  let init = fs.readFileSync(filepath, "utf-8");
  let data = init;
  return {
    edit(editFn: (data: string) => string) {
      data = editFn(data);
      fs.writeFileSync(filepath, data);
    },
    [Symbol.dispose]() {
      fs.writeFileSync(filepath, init);
    },
  };
}

export async function createReloadChecker(page: Page) {
  async function reset() {
    await page.evaluate(() => {
      const el = document.createElement("meta");
      el.setAttribute("name", "x-reload-check");
      document.head.append(el);
    });
  }

  async function check() {
    await sleep(300);
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
  await page.getByText("[hydrated: 1]").click();
}

export function assertNoRequests(page: Page) {
  const requests: Request[] = [];
  function handler(request: Request) {
    requests.push(request);
  }
  page.on("request", handler);
  return {
    [Symbol.dispose]() {
      page.off("request", handler);
      expect(requests.map((req) => req.url())).toEqual([]);
    },
  };
}
