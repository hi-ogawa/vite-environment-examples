import "./lib/polyfill-webpack";
import assert from "node:assert";
import React from "react";
import ReactDomServer from "react-dom/server.edge";
import ReactClient from "react-server-dom-webpack/client.edge";
import type { ViteDevServer } from "vite";
import type { StreamData } from "./entry-rsc";

export default async function handler(request: Request): Promise<Response> {
  console.log(request.url);
  const url = new URL(request.url);
  const response = await handleRsc(request);
  if (url.searchParams.has("__f")) {
    return response;
  }

  assert(response.body);
  const [rscStream1, rscStream2] = response.body.tee();

  const rscPromise = ReactClient.createFromReadableStream<StreamData>(
    rscStream1,
    {
      ssrManifest: {},
    },
  );

  function Root() {
    return React.use(rscPromise);
  }

  const ssrStream = await ReactDomServer.renderToReadableStream(<Root />, {
    bootstrapModules: [],
  });

  rscStream2;
  return new Response(ssrStream, { headers: { "content-type": "text/html" } });
}

declare const __vite_server__: ViteDevServer;

async function handleRsc(request: Request): Promise<Response> {
  return (__vite_server__.environments["rsc"] as any).dispatchFetch(
    "/src/entry-rsc.tsx",
    request,
  );
}
