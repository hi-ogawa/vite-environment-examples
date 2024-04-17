import { renderToWebStream } from "vue/server-renderer";
import { createSSRApp } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { routes } from "./routes";
import App from "./routes/layout.vue";

// cf.
// https://github.com/frandiox/vite-ssr/blob/50461a4e0ebf431fdd96771e069a5e759e275b6b/src/vue/entry-server.ts

export async function handler(req: Request) {
  const url = new URL(req.url);
  const href = url.href.slice(url.origin.length);

  // setup router
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  router.push(href);

  // render app
  const app = createSSRApp(App);
  app.use(router);
  await router.isReady();

  const ssrStream = renderToWebStream(app);
  const html = (await import("virtual:index-html")).default;
  const htmlStream = ssrStream.pipeThrough(injectSsr(html));
  return new Response(htmlStream, { headers: { "content-type": "text/html" } });
}

function injectSsr(html: string) {
  let [pre, post] = html.split("<body>") as [string, string];
  pre = pre + `<body><div id="root">`;
  post = `</div>` + post;
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(pre));
    },
    flush(controller) {
      controller.enqueue(new TextEncoder().encode(post));
    },
  });
}
