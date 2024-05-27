import { splitFirst } from "@hiogawa/utils";
import React from "react";
import ReactDOMServer from "react-dom/server.edge";
import type { ReactServerHandlerResult, StreamData } from "./entry-server";
import {
  createModuleMap,
  initializeReactClientSsr,
} from "./features/client-component/ssr";
import { RouterContext } from "./features/router/client";
import { injectStreamScript } from "./features/utils/stream-script";
import { $__global } from "./global";

export async function handler(request: Request) {
  const reactServer = await importReactServer();
  const result = await reactServer.handler({ request });
  if (new URL(request.url).searchParams.has("__stream")) {
    return new Response(result.stream, {
      headers: { "content-type": "text/x-component; charset=utf-8" },
    });
  }
  const htmlStream = await renderHtml(request, result);
  return new Response(htmlStream, { headers: { "content-type": "text/html" } });
}

async function renderHtml(request: Request, result: ReactServerHandlerResult) {
  initializeReactClientSsr();
  const { default: ReactClient } = await import(
    "react-server-dom-webpack/client.edge"
  );

  const [rscStream1, rscStream2] = result.stream.tee();

  const rscPromise = ReactClient.createFromReadableStream<StreamData>(
    rscStream1,
    {
      ssrManifest: {
        moduleMap: createModuleMap(),
        moduleLoading: null,
      },
    },
  );

  function Root() {
    const url = new URL(request.url);
    return (
      <RouterContext.Provider
        value={{ isPending: false, pathname: url.pathname }}
      >
        <UseStream streamData={rscPromise} />
      </RouterContext.Provider>
    );
  }

  // separate component to contain throwing React.use
  function UseStream(props: { streamData: Promise<StreamData> }) {
    return React.use(props.streamData).node;
  }

  const ssrAssets = (await import("virtual:ssr-assets")).default;

  const ssrStream = await ReactDOMServer.renderToReadableStream(<Root />, {
    formState: result.actionResult,
    bootstrapModules: ssrAssets.bootstrapModules,
  });

  return ssrStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(injectStreamScript(rscStream2))
    .pipeThrough(injectToHead(ssrAssets.head))
    .pipeThrough(new TextEncoderStream());
}

async function importReactServer() {
  let mod: typeof import("./entry-server");
  if (import.meta.env.DEV) {
    mod = (await $__global.reactServerRunner.import(
      "/src/entry-server",
    )) as any;
  } else {
    mod = import("/dist/react-server/index.js" as string) as any;
  }
  return mod;
}

function injectToHead(data: string) {
  const marker = "<head>";
  let done = false;
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      if (!done && chunk.includes(marker)) {
        const [pre, post] = splitFirst(chunk, marker);
        controller.enqueue(pre + marker + data + post);
        done = true;
        return;
      }
      controller.enqueue(chunk);
    },
  });
}
