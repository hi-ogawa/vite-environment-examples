import React from "react";
import { __global } from "./global";
import reactDomServer from "react-dom/server.edge";
import { injectRscStreamScript } from "./utils/rsc-stream-script";
import { initializeWebpackBrowser } from "./features/use-client/browser";
import { createModuleMap } from "./features/use-client/server";

export async function handler(request: Request) {
  const reactServer = await importReactServer();
  const rscStream = await reactServer.handler({ request });
  const htmlStream = await renderHtml(rscStream);
  return new Response(htmlStream, { headers: { "content-type": "text/html" } });
}

async function renderHtml(rscStream: ReadableStream<Uint8Array>) {
  initializeWebpackBrowser();
  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.edge"
  );

  const [rscStream1, rscStream2] = rscStream.tee();

  const rscPromise = reactServerDomClient.createFromReadableStream(rscStream1, {
    ssrManifest: {
      moduleMap: createModuleMap(),
      moduleLoading: null,
    },
  });

  function Root() {
    return React.use(rscPromise);
  }

  const ssrStream = await reactDomServer.renderToReadableStream(<Root />);

  return ssrStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(injectSsr(await importHtmlTemplate()))
    .pipeThrough(injectRscStreamScript(rscStream2))
    .pipeThrough(new TextEncoderStream());
}

async function importReactServer() {
  let mod: typeof import("./entry-react-server");
  if (import.meta.env.DEV) {
    mod = (await __global.reactServerRunner.import(
      "/src/entry-react-server",
    )) as any;
  } else {
    mod = import("/dist/react-server/index.js" as string) as any;
  }
  return mod;
}

async function importHtmlTemplate() {
  if (import.meta.env.DEV) {
    const mod = await import("/index.html?raw");
    return __global.server.transformIndexHtml("/", mod.default);
  } else {
    const mod = await import("/dist/client/index.html?raw");
    return mod.default;
  }
}

function injectSsr(html: string) {
  const [pre, post] = html.split("<!-- SSR -->");
  return new TransformStream<string, string>({
    start(controller) {
      controller.enqueue(pre);
    },
    flush(controller) {
      controller.enqueue(post);
    },
  });
}