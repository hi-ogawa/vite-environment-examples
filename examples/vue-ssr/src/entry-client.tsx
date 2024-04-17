import { createSSRApp } from "vue";
import Page from "./routes/page.vue";

async function main() {
  const app = createSSRApp(Page);
  app.mount("#root");
}

main();
