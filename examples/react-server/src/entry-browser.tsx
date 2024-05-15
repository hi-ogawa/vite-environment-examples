import "virtual:unocss.css";
import React from "react";
import reactDomClient from "react-dom/client";
import type { StreamData } from "./entry-server";
import { listenWindowHistory } from "./features/router/browser";
import { RouterContext } from "./features/router/client";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import { readStreamScript } from "./features/utils/stream-script";
import { $__global } from "./global";

async function main() {
  if (window.location.search.toLowerCase().includes("__nojs")) {
    return;
  }

  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  $__global.callServer = async (id, args) => {
    const url = new URL(window.location.href);
    url.searchParams.set("__stream", "");
    url.searchParams.set("__action_id", id);
    const streamData = reactServerDomClient.createFromFetch<StreamData>(
      fetch(url, {
        method: "POST",
        body: await reactServerDomClient.encodeReply(args),
      }),
      { callServer: $__global.callServer },
    );
    $__setStreamData(streamData);
    return (await streamData).actionResult;
  };

  const initialStreamData =
    reactServerDomClient.createFromReadableStream<StreamData>(
      readStreamScript(),
      { callServer: $__global.callServer },
    );

  let $__setStreamData: (v: Promise<StreamData>) => void;

  function Root() {
    const [streamData, setStreamData] = React.useState(initialStreamData);
    const [isPending, startTransition] = React.useTransition();
    $__setStreamData = (v) => startTransition(() => setStreamData(v));

    React.useEffect(() => {
      return listenWindowHistory(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("__stream", "");
        $__setStreamData(
          reactServerDomClient.createFromFetch<StreamData>(fetch(url), {
            callServer: $__global.callServer,
          }),
        );
      });
    }, []);

    return (
      <RouterContext.Provider value={{ isPending }}>
        <UseStream streamData={streamData} />
      </RouterContext.Provider>
    );
  }

  // separate component to contain throwing React.use
  function UseStream(props: { streamData: Promise<StreamData> }) {
    return React.use(props.streamData).node;
  }

  const reactRootEl = <Root />;

  if (window.location.search.toLowerCase().includes("__nohydrate")) {
    reactDomClient.createRoot(document).render(reactRootEl);
  } else {
    // TODO: can we avoid await? (separate script stream?)
    const formState = (await initialStreamData).actionResult;
    React.startTransition(() => {
      reactDomClient.hydrateRoot(document, reactRootEl, {
        formState,
      });
    });
  }

  if (import.meta.hot) {
    import.meta.hot.on("react-server:update", (e) => {
      console.log("[react-server] hot update", e.file);
      window.history.replaceState({}, "", window.location.href);
    });
  }
}

main();
