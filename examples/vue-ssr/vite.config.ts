import { resolve } from "path";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { vitePluginVirtualIndexHtml } from "../react-ssr/vite.config";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vue(),
    vitePluginSsrMiddleware({
      entry: process.env["SERVER_ENTRY"] || "/src/adapters/node",
      preview: resolve("./dist/server/index.js"),
    }),
    vitePluginVirtualIndexHtml(),
  ],
  environments: {
    client: {
      build: {
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    ssr: {
      build: {
        outDir: "dist/server",
      },
    },
  },

  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments["client"]!);
      await builder.build(builder.environments["ssr"]!);
    },
  },
}));
