// TODO: missing jsxDev in pre-bundle?
import React from "react";

// @ts-ignore
import reactServerDomServer from "react-server-dom-webpack/server.edge";

export default async function handler() {
  const root = (
    <html>
      <body>
        <h1>Hello React Server</h1>
      </body>
    </html>
  );

  const stream: ReadableStream<Uint8Array> =
    reactServerDomServer.renderToReadableStream(root, {});

  await stream.pipeThrough(new TextDecoderStream()).pipeTo(
    new WritableStream({
      write(chunk) {
        console.log(chunk);
      },
    }),
  );
}
