import "./lib/polyfill-webpack";
import ReactServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";

export type StreamData = React.ReactNode;

export default function handler(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("crash-rsc-handler")) {
    throw new Error("boom");
  }
  const root = (
    <html>
      <head></head>
      <body>
        <pre>url: {request.url}</pre>
        <Page url={url} />
      </body>
    </html>
  );
  const stream = ReactServer.renderToReadableStream<StreamData>(root, {}, {});
  return new Response(stream, {
    headers: {
      "content-type": "text/x-component;charset=utf-8",
    },
  });
}
