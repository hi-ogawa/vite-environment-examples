import "./lib/polyfill-webpack";
import ReactServer from "react-server-dom-webpack/server";
import Page from "./routes/page";

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
  const stream = ReactServer.renderToReadableStream(root, {}, {});
  return new Response(stream, {
    headers: {
      "content-type": "text/x-component;charset=utf-8",
    },
  });
}
