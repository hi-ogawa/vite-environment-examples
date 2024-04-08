export class MyDurableObject {
  #state = 0;

  /**
   *
   * @param {Request} req
   * @returns
   */
  fetch(req) {
    return new Response(JSON.stringify({ url: req.url, state: this.#state++ }));
  }
}
