import { tinyassert } from "@hiogawa/utils";
import React from "react";
import reactDomClient from "react-dom/client";
import { readRscStreamScript } from "./utils/rsc-stream-script";

async function main() {
  if (window.location.search.includes("__noCsr")) {
    return;
  }

  // TODO: setup __webpack_require__
  Object.assign(globalThis, { __webpack_require__: () => {} });

  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  const rscStream = readRscStreamScript();
  const rscPromise = reactServerDomClient.createFromReadableStream(
    rscStream,
    {},
  );

  function Root() {
    return React.use(rscPromise);
  }

  const reactRootEl = <Root />;

  const rootEl = document.getElementById("root");
  tinyassert(rootEl);

  if (window.location.search.includes("__noHydrate")) {
    reactDomClient.createRoot(rootEl).render(reactRootEl);
  } else {
    React.startTransition(() => {
      reactDomClient.hydrateRoot(rootEl, reactRootEl);
    });
  }
}

main();
