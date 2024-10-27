import assert from "node:assert";
import type { HotChannel, HotChannelListener, HotPayload } from "vite";

export function createSSEServerTransport(): HotChannel {
  interface SSEClient {
    send(payload: HotPayload): void;
    close(): void;
  }

  const clientMap = new Map<string, SSEClient>();
  const listenerManager = createListenerManager();

  async function handler(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    if (url.pathname === "/sse") {
      // handle `send`
      const senderId = request.headers.get("x-client-id");
      if (senderId) {
        const client = clientMap.get(senderId);
        assert(client);
        const payload = await request.json();
        listenerManager.dispatch(payload, client);
        return Response.json({ ok: true });
      }
      // otherwise handle `connect`
      let controller: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({
        start: (controller_) => {
          controller = controller_;
          controller.enqueue(`:ping\n\n`);
        },
        cancel() {
          clientMap.delete(clientId);
        },
      });
      const pingInterval = setInterval(() => {
        controller.enqueue(`:ping\n\n`);
      }, 10_000);
      const clientId = Math.random().toString(36).slice(2);
      const client: SSEClient = {
        send(payload) {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        },
        close() {
          clearInterval(pingInterval);
          controller.close();
        },
      };
      clientMap.set(clientId, client);
      return new Response(stream, {
        headers: {
          "x-client-id": clientId,
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }
    return undefined;
  }

  const channel: HotChannel = {
    listen() {},
    close() {
      for (const client of clientMap.values()) {
        client.close();
      }
    },
    on: listenerManager.on,
    off: listenerManager.off,
    send: (payload) => {
      for (const client of clientMap.values()) {
        client.send(payload);
      }
    },
    // expose SSE handler via hot.api
    api: {
      type: "sse",
      handler,
    },
  };

  return channel;
}

// wrapper to simplify listener management
function createListenerManager(): Pick<HotChannel, "on" | "off"> & {
  dispatch: (
    payload: HotPayload,
    client: { send: (payload: HotPayload) => void },
  ) => void;
} {
  const listerMap: Record<string, Set<HotChannelListener>> = {};
  const getListerMap = (e: string) => (listerMap[e] ??= new Set());

  return {
    on(event: string, listener: HotChannelListener) {
      // console.log("[channel.on]", event, listener);
      if (event === "connection") {
        return;
      }
      getListerMap(event).add(listener);
    },
    off(event, listener: any) {
      // console.log("[channel.off]", event, listener);
      if (event === "connection") {
        return;
      }
      getListerMap(event).delete(listener);
    },
    dispatch(payload, client) {
      if (payload.type === "custom") {
        for (const lister of getListerMap(payload.event)) {
          lister(payload.data, client);
        }
      }
    },
  };
}
