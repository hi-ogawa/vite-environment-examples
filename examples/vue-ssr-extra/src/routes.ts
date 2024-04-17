import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("./routes/page.vue"),
    name: "home",
  },
  {
    path: "/client",
    component: () => import("./routes/client/page.vue"),
    name: "client",
  },
  {
    path: "/server",
    component: () => import("./routes/server/page.vue"),
    name: "server",
  },
  {
    path: "/:catchAll(.*)",
    component: () => import("./routes/not-found.vue"),
    name: "not-found",
  },
];
