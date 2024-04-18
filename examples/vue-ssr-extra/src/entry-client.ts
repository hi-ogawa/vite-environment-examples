import { createSSRApp } from "vue";
import { createWebHistory, createRouter } from "vue-router";
import { routes } from "./routes";
import Root from "./root.vue";
import { createPinia } from "pinia";

async function main() {
  if (window.location.search.includes("__nojs")) {
    return;
  }

  const router = createRouter({
    history: createWebHistory(),
    routes,
  });
  const pinia = createPinia();
  pinia.state.value = (globalThis as any).__serverPiniaState;

  const app = createSSRApp(Root);
  app.use(router);
  app.use(pinia);

  await router.isReady();
  app.mount("#root");
}

main();
