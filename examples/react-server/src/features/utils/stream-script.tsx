// cf.
// https://github.com/vercel/next.js/blob/1c5aa7fa09cc5503c621c534fc40065cbd2aefcb/packages/next/src/server/app-render/use-flight-response.tsx#L19-L26
// https://github.com/vercel/next.js/blob/1c5aa7fa09cc5503c621c534fc40065cbd2aefcb/packages/next/src/client/app-index.tsx#L110-L113
// https://github.com/devongovett/rsc-html-stream/

export function injectStreamScript(stream: ReadableStream<Uint8Array>) {
  const search = "</body>";
  return new TransformStream<string, string>({
    async transform(chunk, controller) {
      if (!chunk.includes(search)) {
        controller.enqueue(chunk);
        return;
      }

      const [pre, post] = chunk.split(search);
      controller.enqueue(pre);
      controller.enqueue(`<script>self.__$stream||=[]</script>`);

      // TODO: handle cancel?
      await stream.pipeThrough(new TextDecoderStream()).pipeTo(
        new WritableStream({
          write(chunk) {
            controller.enqueue(
              `<script>__$stream.push(${JSON.stringify(chunk)})</script>`,
            );
          },
        }),
      );

      controller.enqueue(search + post);
    },
  });
}

export function readStreamScript() {
  return new ReadableStream<string>({
    start(controller) {
      const chunks: string[] = ((globalThis as any).__$stream ||= []);

      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      chunks.push = function (chunk) {
        controller.enqueue(chunk);
        return 0;
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          controller.close();
        });
      } else {
        controller.close();
      }
    },
  }).pipeThrough(new TextEncoderStream());
}
