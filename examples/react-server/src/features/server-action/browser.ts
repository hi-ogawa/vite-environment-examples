import reactServerDomClient from "react-server-dom-webpack/client.browser";
import { __global } from "../../global";

export function createServerReference(id: string) {
  return reactServerDomClient.createServerReference(id, (...args) =>
    __global.callServer(...args),
  );
}
