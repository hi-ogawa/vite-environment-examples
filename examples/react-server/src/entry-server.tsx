import ReactServer from "react-server-dom-webpack/server.edge";
import { createBundlerConfig } from "./features/client-component/server";
import { serverActionHandler } from "./features/server-action/server";
import Layout from "./routes/layout";

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

  const node = <Router request={request} />;

  const stream = ReactServer.renderToReadableStream<StreamData>(
    {
      node,
      actionResult: actionResult,
    },
    createBundlerConfig(),
  );

  return { stream, actionResult };
}

const routes = {
  "/": () => import("./routes/page"),
  "/action": () => import("./routes/action/page"),
  "/slow": () => import("./routes/slow/page"),
};

async function Router(props: { request: Request }) {
  const url = new URL(props.request.url);
  const route = routes[url.pathname as "/"];
  let node = <h4>Not Found</h4>;
  if (route) {
    const mod = await route();
    const Page = mod.default;
    node = <Page />;
  }
  return <Layout>{node}</Layout>;
}

export async function testRender(Comp: React.ComponentType) {
  return ReactServer.renderToReadableStream(<Comp />, createBundlerConfig());
}
