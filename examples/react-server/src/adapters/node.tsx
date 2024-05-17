import { getRequestListener } from "@hono/node-server";
import { handler } from "../entry-ssr";

export default getRequestListener(handler);
