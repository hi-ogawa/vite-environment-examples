import { tinyassert } from "@hiogawa/utils";
import React from "react";
import reactDomClient from "react-dom/client";
import { readRscStreamScript } from "./utils/rsc-stream-script";
import { initializeWebpackServer } from "./features/use-client/server";
import type { StreamData } from "./features/stream/utils";

async function main() {
  if (window.location.search.includes("__noCsr")) {
    return;
  }

  initializeWebpackServer();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  const initialStreamData =
    reactServerDomClient.createFromReadableStream<StreamData>(
      readRscStreamScript(),
      {},
    );

  let __setStreamData: (v: Promise<StreamData>) => void;

  function Root() {
    const [streamData, setStreamData] = React.useState(initialStreamData);
    const [_isPending, startTransition] = React.useTransition();
    __setStreamData = (v) => startTransition(() => setStreamData(v));
    return React.use(streamData);
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

  if (import.meta.hot) {
    import.meta.hot.on("react-server:update", (e) => {
      console.log("[react-server] hot update", e.file);
      const streamData = reactServerDomClient.createFromFetch<StreamData>(
        fetch("/?__rsc"),
        {},
      );
      __setStreamData(streamData);
    });
  }
}

main();
