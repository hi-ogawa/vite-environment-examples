import { createSSRApp } from "vue";
import { createWebHistory, createRouter } from "vue-router";
import { routes } from "./routes";
import App from "./routes/layout.vue";

async function main() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  const app = createSSRApp(App);
  app.use(router);

  await router.isReady();
  app.mount("#root");
}

main();
