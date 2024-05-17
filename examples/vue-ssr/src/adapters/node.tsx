import { getRequestListener } from "@hono/node-server";
import { handler } from "../entry-server";

export default getRequestListener(handler);
