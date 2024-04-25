import { test, expect } from "vitest";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import React from "react";
import { createManualPromise, sleep } from "@hiogawa/utils";
import reactDomClient from "react-dom/client";
import { Window } from "happy-dom";

test("basic", async () => {
  Object.assign(globalThis, {
    window: new Window({ url: "https://localhost:8080" }),
  });
  const document = window.document;

  // TODO: setup/cleanup helper?
  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  if (0) {
    // TODO: fetch rsc stream?
    reactServerDomClient.createFromReadableStream(new ReadableStream());
  }

  const demo = sleep(300).then(() => <div>hello</div>);

  // wait until mounted
  const mounted = createManualPromise<void>();

  function Root() {
    React.useEffect(() => {
      mounted.resolve();
    }, []);

    return React.use(demo);
  }

  reactDomClient.createRoot(document.body).render(<Root />);
  await mounted;
  expect(document.body).toMatchInlineSnapshot(`
    <body>
      <div>
        hello
      </div>
    </body>
  `);
});
