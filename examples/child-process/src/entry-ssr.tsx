import "./lib/polyfill-webpack";
import assert from "node:assert";
import React from "react";
import ReactDomServer from "react-dom/server.edge";
import ReactClient from "react-server-dom-webpack/client.edge";
import type { StreamData } from "./entry-rsc";
import type { ChildProcessFetchDevEnvironment } from "./lib/vite/environment";

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.has("crash-ssr-handler")) {
    throw new Error("boom");
  }

  const response = await handleRsc(request);
  if (!response.ok) {
    return response;
  }

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
    return (
      <>
        <meta name="node-version" content={process.version} />
        {React.use(rscPromise)}
      </>
    );
  }

  const ssrStream = await ReactDomServer.renderToReadableStream(<Root />, {
    bootstrapModules: [],
  });

  rscStream2;
  return new Response(ssrStream, { headers: { "content-type": "text/html" } });
}

declare const __vite_environment_rsc__: ChildProcessFetchDevEnvironment;

async function handleRsc(request: Request): Promise<Response> {
  return __vite_environment_rsc__.dispatchFetch("/src/entry-rsc.tsx", request);
}
