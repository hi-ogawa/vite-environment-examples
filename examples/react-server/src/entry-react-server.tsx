import reactServerDomServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";
import { createBundlerConfig } from "./features/use-client/react-server";
import { serverActionHandler } from "./features/server-action/react-server";

export type StreamData = React.ReactNode;

export async function handler({ request }: { request: Request }) {
  if (request.method === "POST") {
    await serverActionHandler({ request });
  }

  const root = <Page />;

  const stream = reactServerDomServer.renderToReadableStream<StreamData>(
    root,
    createBundlerConfig(),
  );

  return stream;
}
