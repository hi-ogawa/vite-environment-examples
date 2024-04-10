import { handler } from "../entry-server";

export default {
  fetch(request: Request, env: unknown) {
    Object.assign(globalThis, { env });
    return handler(request);
  },
};
