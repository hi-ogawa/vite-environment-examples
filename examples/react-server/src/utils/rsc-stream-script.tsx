// cf. https://github.com/devongovett/rsc-html-stream/

export function injectRscStreamScript(rscStream: ReadableStream<Uint8Array>) {
  const search = "</body>";
  return new TransformStream<string, string>({
    async transform(chunk, controller) {
      if (chunk.includes(search)) {
        const [pre, post] = chunk.split(search);
        controller.enqueue(pre);
        controller.enqueue(`<script>globalThis.__rscChunks ||= []</script>`);

        // TODO: better encoding
        const chunks = rscStream.pipeThrough(
          new TextDecoderStream(),
        ) as any as AsyncIterable<string>;
        for await (const chunk of chunks) {
          controller.enqueue(
            `<script>__rscChunks.push(${JSON.stringify(chunk)})</script>`,
          );
        }
        controller.enqueue(`<script>__rscChunks.push("__rscClose")</script>`);

        controller.enqueue(search + post);
      } else {
        controller.enqueue(chunk);
      }
    },
  });
}

export function readRscStreamScript() {
  return new ReadableStream<string>({
    start(controller) {
      function handleChunk(chunk: string) {
        if (chunk === "__close") {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      }

      const rscChunks: string[] = ((globalThis as any).__rscChunks ||= []);
      for (const chunk of rscChunks) {
        handleChunk(chunk);
      }

      const oldPush = rscChunks.push;
      rscChunks.push = function (chunk) {
        handleChunk(chunk);
        return oldPush.apply(this, [chunk]);
      };
    },
  }).pipeThrough(new TextEncoderStream());
}
