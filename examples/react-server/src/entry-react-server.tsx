import reactServerDomServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";
import { createBundlerConfig } from "./features/use-client/react-server";

export type StreamData = React.ReactNode;

export async function handler({}: { request: Request }) {
  const root = <Page />;

  const stream = reactServerDomServer.renderToReadableStream<StreamData>(
    root,
    createBundlerConfig(),
  );

  return stream;
}
