export default {
  async fetch(request: Request, env: unknown) {
    const entry = request.headers.get("x-vite-eval-entry")!;
    const fnString = request.headers.get("x-vite-eval-fn-string")!;
    fnString;
    // await import("seroval");
    const fn = (0, eval)(fnString);
    env;
    const mod = await import(/* @vite-ignore */ entry);
    mod;
    const args = request.body;
    const result = await fn({ env, mod, args });
    result;
    return new Response(null);
  },
};
