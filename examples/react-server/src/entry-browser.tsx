import "virtual:unocss.css";
import React from "react";
import ReactDOMClient from "react-dom/client";
import type { StreamData } from "./entry-server";
import { initializeReactClientBrowser } from "./features/client-component/browser";
import {
  BackForawrdCache,
  listenWindowHistory,
} from "./features/router/browser";
import { RouterContext } from "./features/router/client";
import { readStreamScript } from "./features/utils/stream-script";
import { $__global } from "./global";

async function main() {
  if (window.location.search.toLowerCase().includes("__nojs")) {
    return;
  }

  // need to import after __webpack_require__ is defined
  // https://github.com/facebook/react/blob/ea6e05912aa43a0bbfbee381752caa1817a41a86/packages/react-server-dom-webpack/src/ReactFlightClientConfigBundlerWebpackBrowser.js#L16
  initializeReactClientBrowser();
  const { default: ReactClient } = await import(
    "react-server-dom-webpack/client.browser"
  );

  const bfcache = new BackForawrdCache<Promise<StreamData>>();

  $__global.callServer = async (id, args) => {
    const url = new URL(window.location.href);
    url.searchParams.set("__stream", "");
    url.searchParams.set("__action_id", id);
    const streamData = ReactClient.createFromFetch<StreamData>(
      fetch(url, {
        method: "POST",
        body: await ReactClient.encodeReply(args),
      }),
      { callServer: $__global.callServer },
    );
    $__setStreamData(streamData);
    bfcache.set(streamData);
    return (await streamData).actionResult;
  };

  const initialStreamData = ReactClient.createFromReadableStream<StreamData>(
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
        const fetchFlight = () =>
          ReactClient.createFromFetch<StreamData>(fetch(url), {
            callServer: $__global.callServer,
          });
        $__setStreamData(bfcache.run(fetchFlight));
      });
    }, []);

    return (
      <RouterContext.Provider
        value={{ isPending, pathname: window.location.pathname }}
      >
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
    ReactDOMClient.createRoot(document).render(reactRootEl);
  } else {
    // TODO: can we avoid await? (separate script stream?)
    const formState = (await initialStreamData).actionResult;
    React.startTransition(() => {
      ReactDOMClient.hydrateRoot(document, reactRootEl, {
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
