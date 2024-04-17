import { renderToString } from "vue/server-renderer";
import { createSSRApp } from "vue";
import Page from "./routes/page.vue";

export async function handler(_req: Request) {
  const app = createSSRApp(Page);
  const ssrHtml = await renderToString(app);
  let html = (await import("virtual:index-html")).default;
  html = html.replace(/<body>/, `<body><div id="root">${ssrHtml}</div>`);
  return new Response(html, { headers: { "content-type": "text/html" } });
}
