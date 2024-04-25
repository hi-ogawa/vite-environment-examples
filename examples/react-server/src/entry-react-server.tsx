import reactServerDomServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";
import { createBundlerConfig } from "./features/use-client/react-server";
import { serverActionHandler } from "./features/server-action/react-server";

export type StreamData = {
  node: React.ReactNode;
  actionResult?: unknown;
};

export interface ReactServerHandlerResult {
  stream: ReadableStream<Uint8Array>;
  actionResult?: unknown;
}

export async function handler({
  request,
}: {
  request: Request;
}): Promise<ReactServerHandlerResult> {
  let actionResult: unknown;
  if (request.method === "POST") {
    actionResult = await serverActionHandler({ request });
  }

  const node = <Page />;

  const stream = reactServerDomServer.renderToReadableStream<StreamData>(
    {
      node,
      actionResult: actionResult,
    },
    createBundlerConfig(),
  );

  return { stream, actionResult };
}

export async function testRender(Comp: React.ComponentType) {
  return reactServerDomServer.renderToReadableStream(
    <Comp />,
    createBundlerConfig(),
  );
}
