import "./style.css";
import { createPinia } from "pinia";
import { createSSRApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import Root from "./root.vue";
import { routes } from "./routes";

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
