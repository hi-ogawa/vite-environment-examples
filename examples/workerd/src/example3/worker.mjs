// @ts-nocheck

export class MyDurableObject {
  /**
   *
   * @param {Request} req
   * @returns
   */
  fetch(req) {
    const [webSocket1, webSocket2] = Object.values(new WebSocketPair());
    webSocket1.accept();
    webSocket1.addEventListener("message", (event) => {
      webSocket1.send("echo:" + event.data);
    });
    return new Response(null, { status: 101, webSocket: webSocket2 });
  }
}
