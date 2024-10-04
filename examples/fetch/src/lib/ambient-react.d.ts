declare module "react-dom/server.edge" {
  export * from "react-dom/server";
}

declare module "react-server-dom-webpack/server.edge" {
  export function renderToReadableStream<T>(
    data: T,
    bundlerConfig: unknown,
    opitons?: unknown,
  ): ReadableStream<Uint8Array>;
}

declare module "react-server-dom-webpack/client.edge" {
  export function createFromReadableStream<T>(
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ): Promise<T>;
}

declare module "react-server-dom-webpack/client.browser" {
  export function createFromReadableStream<T>(
    stream: ReadableStream<Uint8Array>,
    options?: unknown,
  ): Promise<T>;
}
