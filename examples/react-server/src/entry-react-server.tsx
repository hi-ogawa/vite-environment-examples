import reactServerDomServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";
import { createBundlerConfig } from "./features/use-client/react-server";

export async function handler({}: { request: Request }) {
  const root = <Page />;

  const stream = reactServerDomServer.renderToReadableStream(
    root,
    createBundlerConfig(),
  );

  return stream;
}
