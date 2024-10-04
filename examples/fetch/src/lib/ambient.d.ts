declare module "react-server-dom-webpack/server" {
  export function renderToReadableStream<T>(
    data: T,
    bundlerConfig: unknown,
    opitons?: unknown,
  ): ReadableStream<Uint8Array>;
}

declare module "react-server-dom-webpack/client" {
  export function createFromReadableStream<T>(
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ): Promise<T>;
}
