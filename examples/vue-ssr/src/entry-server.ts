import { renderToWebStream } from "vue/server-renderer";
import { createSSRApp } from "vue";
import Page from "./routes/page.vue";

export async function handler(_req: Request) {
  const app = createSSRApp(Page);
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
