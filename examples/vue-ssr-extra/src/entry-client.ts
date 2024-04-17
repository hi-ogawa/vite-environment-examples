import { createSSRApp } from "vue";
import { createWebHistory, createRouter } from "vue-router";
import { routes } from "./routes";
import Root from "./root.vue";

async function main() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  const app = createSSRApp(Root);
  app.use(router);

  await router.isReady();
  app.mount("#root");
}

main();
