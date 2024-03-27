import React from "react";
import { __global } from "./global";
import reactDomServer from "react-dom/server.edge";

export async function handler(request: Request) {
  if (0) {
    return new Response("hello?", { headers: { "content-type": "text/html" } });
  }
  const reactServer = await importReactServer();
  const rscStream = await reactServer.handler({ request });
  const htmlStream = await renderHtml(rscStream);
  return new Response(htmlStream, { headers: { "content-type": "text/html" } });
}

async function renderHtml(rscStream: ReadableStream<Uint8Array>) {
  // TODO
  // initDomWebpackSsr

  const { default: reactServerDomClient } = await import(
    "react-server-dom-webpack/client.edge"
  );

  const rscPromise = reactServerDomClient.createFromReadableStream(rscStream, {
    ssrManifest: {
      moduleMap: {},
      moduleLoading: null,
    },
  });

  function Root() {
    return React.use(rscPromise);
  }

  const ssrStream = await reactDomServer.renderToReadableStream(<Root />);

  // TODO: for now stringify
  let ssrHtml = "";
  ssrStream.pipeThrough(new TextDecoderStream()).pipeTo(
    new WritableStream({
      write(chunk) {
        ssrHtml += chunk;
      },
    }),
  );

  let html = await importHtmlTemplate();
  html = html.replace(/<body>/, `<body><div id="root">${ssrHtml}</div>`);

  return html;
}

async function importReactServer() {
  let mod: typeof import("./entry-react-server");
  if (import.meta.env.DEV) {
    // TODO: module graph missing and it leads to throwOutdatedRequest?
    // https://github.com/vitejs/vite/blob/36463d21b72a6b7f6f261999df1017008f4f805a/packages/vite/src/node/plugins/importAnalysis.ts#L248-L257
    await __global.reactServerRunner.import("/node_modules/.vite/.env-deps/react-server/deps/chunk-TLGN5FSQ.js");
    await __global.reactServerRunner.import("react");
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
