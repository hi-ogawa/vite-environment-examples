import ReactDomServer from "react-dom/server.edge";
import { Root } from "./routes";

export async function handler(_req: Request) {
  const ssrHtml = ReactDomServer.renderToString(<Root />);
  let html = (await import("virtual:index.html")).default;
  html = html.replace(/<body>/, `<body><div id="root">${ssrHtml}</div>`);
  return new Response(html, { headers: { "content-type": "text/html" } });
}
