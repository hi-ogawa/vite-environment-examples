import ReactDomServer from "react-dom/server.edge";
import { crashSsr } from "./crash-ssr";
import Page from "./routes/page";

export async function handler(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/api") {
    return apiHandler(request);
  }
  if (url.pathname === "/nodejs-compat") {
    const util = await import("node:util");
    return new Response(util.format("hello %s", "world"));
  }
  if (url.pathname === "/crash-ssr") {
    crashSsr("crash ssr");
  }

  const ssrHtml = ReactDomServer.renderToString(<Page />);
  let html = (await import("virtual:index-html")).default;
  html = html.replace("<body>", () => `<body><div id="root">${ssrHtml}</div>`);
  return new Response(html, { headers: { "content-type": "text/html" } });
}

async function apiHandler(request: Request) {
  let count = Number(await env.kv.get("count"));
  if (request.method === "POST") {
    const { delta } = await request.json();
    count += delta;
    await env.kv.put("count", String(count));
  }
  return new Response(JSON.stringify({ count }));
}
