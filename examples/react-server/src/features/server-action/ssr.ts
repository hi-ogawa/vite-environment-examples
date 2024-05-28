import reactServerDomClient from "react-server-dom-webpack/client.edge";

export function createServerReference(id: string, name: string) {
  id = id + "#" + name;
  return reactServerDomClient.createServerReference(id, (...args) => {
    console.error(args);
    throw new Error("unexpected callServer during SSR");
  });
}
