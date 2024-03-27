import React from "react";
import reactServerDomServer from "react-server-dom-webpack/server.edge";
import { Root } from "./routes";

export async function handler({}: { request: Request }) {
  const root = <Root />;

  const stream = reactServerDomServer.renderToReadableStream(root, {});

  return stream;
}
