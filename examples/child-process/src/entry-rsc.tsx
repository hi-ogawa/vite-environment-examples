import "./lib/polyfill-webpack";
import ReactServer from "react-server-dom-webpack/server.edge";
import Page from "./routes/page";

export type StreamData = React.ReactNode;

export default function handler(request: Request) {
  const root = (
    <html>
      <head></head>
      <body>
        <pre>url: {request.url}</pre>
        <Page />
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