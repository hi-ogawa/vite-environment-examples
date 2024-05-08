import { createPinia } from "pinia";
import { createSSRApp } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { renderToString } from "vue/server-renderer";
import { serverActionHandler } from "./features/server-action/server";
import Root from "./root.vue";
import { routes } from "./routes";

export async function handler(request: Request) {
  if (request.method === "POST") {
    return serverActionHandler({ request });
  }

  // setup router
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  const url = new URL(request.url);
  const href = url.href.slice(url.origin.length);
  router.push(href);

  // setup pinia
  const pinia = createPinia();

  // setup app
  const app = createSSRApp(Root);
  app.use(router);
  app.use(pinia);

  // render
  await router.isReady();
  const ssrHtml = await renderToString(app);

  let html = (await import("virtual:index-html")).default;
  html = html.replace("<body>", () => `<body><div id="root">${ssrHtml}</div>`);
  html = html.replace(
    "<head>",
    () =>
      `<head><script>globalThis.__serverPiniaState = ${JSON.stringify(
        pinia.state.value,
      )}</script>`,
  );
  // dev only FOUC fix
  if (import.meta.env.DEV) {
    html = html.replace(
      "<head>",
      `<head><link rel="stylesheet" href="/src/style.css?direct" />`,
    );
  }
  return new Response(html, { headers: { "content-type": "text/html" } });
}
