import { test, expect } from "vitest";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import React from "react";
import { createManualPromise } from "@hiogawa/utils";
import reactDomClient from "react-dom/client";
import { Window } from "happy-dom";

test("basic", async () => {
  // happy-dom
  Object.assign(globalThis, {
    window: new Window({ url: "https://localhost:8080" }),
  });
  const document = window.document;

  // react client browser
  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  // fetch rsc stream via virtual module
  const testStream = await import(
    "virtual:test-react-server-stream/src/routes/page"
  );
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
  expect(document.body).toMatchSnapshot();
});
