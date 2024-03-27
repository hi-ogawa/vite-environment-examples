import { tinyassert } from "@hiogawa/utils";
import React from "react";
import reactDomClient from "react-dom/client";

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

function readRscStreamScript() {
  return new ReadableStream<string>({
    start(controller) {
      function handleChunk(chunk: string) {
        if (chunk === "__rscClose") {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      }

      const rscChunks: string[] = ((globalThis as any).__rscChunks ||= []);
      for (const chunk of rscChunks) {
        handleChunk(chunk);
      }

      const oldPush = rscChunks.push;
      rscChunks.push = function (chunk) {
        handleChunk(chunk);
        return oldPush.apply(this, [chunk]);
      };
    },
  }).pipeThrough(new TextEncoderStream());
}

main();
