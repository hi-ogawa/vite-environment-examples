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
  if (url.pathname === "/hot-custom" && import.meta.hot) {
    const promise = Promise.withResolvers<any>();
    const hot = import.meta.hot;
    hot.on("send-to-runner", function handler(e) {
      console.log("[send-to-runner]", e);
      hot.off("send-to-runner", handler);
      promise.resolve(JSON.stringify(e));
    });
    hot.send("send-to-server", { runner: "ok" });
    return new Response(await promise.promise);
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
