export class RunnerObject implements DurableObject {
  fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "___viteInit") {
    }
    const { 0: webSocket1, 1: webSocket2 } = new WebSocketPair();
    (webSocket1 as any).accept();
    webSocket1.addEventListener("message", (event) => {
      webSocket1.send("echo:" + event.data);
    });
    return new Response(null, { status: 101, webSocket: webSocket2 });
  }
}
