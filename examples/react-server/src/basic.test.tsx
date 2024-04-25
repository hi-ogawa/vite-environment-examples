import { test, expect, beforeEach, vi } from "vitest";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import React from "react";
import { createManualPromise } from "@hiogawa/utils";
import reactDomClient from "react-dom/client";
import { Window } from "happy-dom";

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

async function testRender(page: string) {
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

  reactDomClient.createRoot(document.body).render(<Root />);
  await mounted;
}

test("basic", async () => {
  await testRender("/src/routes/page");
  await vi.waitUntil(() =>
    document.body.querySelector(`[data-hydrated="true"]`),
  );
  expect(document.body).toMatchSnapshot();
});

test("test async", async () => {
  await testRender("/src/routes/test/page");
  expect(document.body).toMatchSnapshot();
});
