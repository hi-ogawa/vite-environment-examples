import { tinyassert } from "@hiogawa/utils";
import React from "react";
import reactDomClient from "react-dom/client";
import { readRscStreamScript } from "./utils/rsc-stream-script";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import type { StreamData } from "./entry-react-server";
import { $__global } from "./global";
import { injectActionId } from "./features/server-action/utils";

async function main() {
  if (window.location.search.includes("__nojs")) {
    return;
  }

  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  $__global.callServer = (id, args) => {
    tinyassert(args.length === 1);
    tinyassert(args[0] instanceof FormData);
    const body = args[0];
    injectActionId(body, id);
    const streamData = reactServerDomClient.createFromFetch<StreamData>(
      fetch("/?__rsc", { method: "POST", body }),
      { callServer: $__global.callServer },
    );
    __setStreamData(streamData);
  };

  const initialStreamData =
    reactServerDomClient.createFromReadableStream<StreamData>(
      readRscStreamScript(),
      { callServer: $__global.callServer },
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
        { callServer: $__global.callServer },
      );
      __setStreamData(streamData);
    });
  }
}

main();
