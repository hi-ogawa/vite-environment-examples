import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import Page from "./routes/page.vue";
import { createWebHistory, createRouter } from "vue-router";
import Root from "./root.vue";

async function main() {
  const pinia = createPinia();
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/", component: Page }],
  });
  await router.isReady();

  const app = createSSRApp(Root);
  app.use(pinia);
  app.use(router);
  app.mount("#root");
}

main();
