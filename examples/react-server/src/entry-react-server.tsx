import React from "react";
import reactServerDomServer from "react-server-dom-webpack/server.edge";
import { Root } from "./routes";
import { createBundlerConfig } from "./features/use-client/react-server";

export async function handler({}: { request: Request }) {
  const root = <Root />;

  const stream = reactServerDomServer.renderToReadableStream(
    root,
    createBundlerConfig(),
  );

  return stream;
}
