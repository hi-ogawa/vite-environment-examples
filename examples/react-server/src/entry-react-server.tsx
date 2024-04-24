import reactServerDomServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";
import { createBundlerConfig } from "./features/use-client/react-server";
import { serverActionHandler } from "./features/server-action/react-server";

export type StreamData = {
  node: React.ReactNode;
  actionState?: unknown;
};

export async function handler({ request }: { request: Request }) {
  let actionState: unknown;
  if (request.method === "POST") {
    actionState = await serverActionHandler({ request });
  }

  const node = <Page />;

  const stream = reactServerDomServer.renderToReadableStream<StreamData>(
    {
      node,
      actionState,
    },
    createBundlerConfig(),
  );

  return stream;
}
