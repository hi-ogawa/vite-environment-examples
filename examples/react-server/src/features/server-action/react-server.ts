import reactServerDomWebpack from "react-server-dom-webpack/server.edge";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  return reactServerDomWebpack.registerServerReference(action, id, name);
}
