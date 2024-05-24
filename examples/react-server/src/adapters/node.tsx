import { webToNodeHandler } from "@hiogawa/utils-node";
import { handler } from "../entry-ssr";

export default webToNodeHandler(handler);
