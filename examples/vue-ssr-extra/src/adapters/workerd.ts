import { handler } from "../entry-server";
import { setEnv } from "../env";

export default {
  fetch: (request: Request, env: any) => {
    setEnv(env);
    return handler(request);
  },
};
