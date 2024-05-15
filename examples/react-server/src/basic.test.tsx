import { createManualPromise } from "@hiogawa/utils";
import { Window } from "happy-dom";
import React from "react";
import reactDomClient from "react-dom/client";
import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { initializeWebpackBrowser } from "./features/use-client/browser";

beforeAll(() => {
  // doing the same as examples/react-server/src/features/bootstrap/plugin.ts
  (globalThis as any).__raw_import = (id: string) =>
    import(/* @vite-ignore */ id);
});

// happy-dom
beforeEach(() => {
  const window = new Window({ url: "https://localhost:8080" });
  Object.assign(globalThis, {
    window,
    document: window.document,
  });
  return () => {
    window.close();
  };
});

async function testRender(container: reactDomClient.Container, page: string) {
  // react client browser
  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  // fetch rsc stream via virtual module
  const testStream = await import("virtual:test-react-server-stream" + page);
  const testNode =
    reactServerDomClient.createFromReadableStream<React.ReactNode>(
      testStream.default,
    );

  // render
  const mounted = createManualPromise<void>();

  function Root() {
    React.useEffect(() => {
      mounted.resolve();
    }, []);
    return React.use(testNode);
  }

  reactDomClient.createRoot(container).render(<Root />);
  await mounted;
}

test("basic", async () => {
  await testRender(document.body, "/src/routes/page");
  await vi.waitUntil(() =>
    document.body.querySelector(`[data-hydrated="true"]`),
  );
  expect(document.firstElementChild).toMatchSnapshot();
});
