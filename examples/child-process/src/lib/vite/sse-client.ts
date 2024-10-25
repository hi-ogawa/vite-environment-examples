import assert from "node:assert";

export async function createSSEClient(
  url: string,
  handlers: {
    onMessage: (payload: any) => void;
    onDisconnection: () => void;
  },
) {
  const response = await fetch(url);
  assert(response.ok);
  const clientId = response.headers.get("x-client-id");
  assert(clientId);
  assert(response.body);
  response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(splitTransform("\n\n"))
    .pipeTo(
      new WritableStream({
        write(chunk) {
          // console.log("[client.response]", chunk);
          if (chunk.startsWith("data: ")) {
            const payload = JSON.parse(chunk.slice("data: ".length));
            handlers.onMessage(payload);
          }
        },
        abort(e) {
          console.log("[client.abort]", e);
        },
        close() {
          console.log("[client.close]");
          handlers.onDisconnection();
        },
      }),
    )
    .catch((e) => {
      console.log("[client.pipeTo.catch]", e);
    });

  return {
    send: async (payload: unknown) => {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "x-client-id": clientId,
        },
      });
      assert(response.ok);
      const result = await response.json();
      return result;
    },
  };
}

export function splitTransform(sep: string): TransformStream<string, string> {
  let pending = "";
  return new TransformStream({
    transform(chunk, controller) {
      while (true) {
        const i = chunk.indexOf(sep);
        if (i >= 0) {
          pending += chunk.slice(0, i);
          controller.enqueue(pending);
          pending = "";
          chunk = chunk.slice(i + sep.length);
          continue;
        }
        pending += chunk;
        break;
      }
    },
  });
}
