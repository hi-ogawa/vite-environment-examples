import { defineConfig } from "vite";
import {
  vitePluginSsrMiddleware,
  vitePluginVirtualIndexHtml,
} from "../react-ssr/vite.config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    vue(),
    vitePluginSsrMiddleware({
      entry: "/src/adapters/node",
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
    async buildEnvironments(builder, build) {
      await build(builder.environments["client"]!);
      await build(builder.environments["ssr"]!);
    },
  },
}));
