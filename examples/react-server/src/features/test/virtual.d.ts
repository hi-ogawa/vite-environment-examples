declare module "virtual:test-react-server-stream/*" {
  const stream: ReadableStream<Uint8Array>;
  export default stream;
}
