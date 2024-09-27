declare module "*?worker-runner" {
  const src: string;
  export default src;
}

declare module "react-server-dom-webpack/server" {
  export function renderToReadableStream<T>(
    data: T,
    bundlerConfig: unknown,
    opitons?: unknown,
  ): ReadableStream<Uint8Array>;
}
