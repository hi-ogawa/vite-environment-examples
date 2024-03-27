declare module "react-server-dom-webpack/server.edge" {
  export function renderToReadableStream(
    ...args: unknown[]
  ): ReadableStream<Uint8Array>;
}
