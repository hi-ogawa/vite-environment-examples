export class MyDurableObject {
  /**
   *
   * @param {Request} req
   * @returns
   */
  fetch(req) {
    return new Response("yaayy: " + req.url);
  }
}
