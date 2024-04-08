import ReactDomServer from "react-dom/server.edge";
import { Root } from "./routes";
import { __global } from "./global";

export async function handler(_req: Request) {
  const ssrHtml = ReactDomServer.renderToString(<Root />);
  if (1) {
    return new Response(ssrHtml, { headers: { "content-type": "text/html" } });
  }
  let html = await importHtml();
  html = html.replace(/<body>/, `<body><div id="root">${ssrHtml}</div>`);
  return new Response(html, { headers: { "content-type": "text/html" } });
}

async function importHtml() {
  if (import.meta.env.DEV) {
    const mod = await import("/index.html?raw");
    return __global.server.transformIndexHtml("/", mod.default);
  } else {
    const mod = await import("/dist/client/index.html?raw");
    return mod.default;
  }
}
