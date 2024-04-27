import fs from "node:fs";
import { resolve } from "node:path";
import { vitePluginLogger } from "@hiogawa/vite-plugin-ssr-middleware";
import { vitePluginSsrMiddleware } from "@hiogawa/vite-plugin-ssr-middleware-alpha";
import react from "@vitejs/plugin-react";
import { type Plugin, type ViteDevServer, defineConfig } from "vite";

export default defineConfig((_env) => ({
  clearScreen: false,
  appType: "custom",
  plugins: [
    react(),
    vitePluginLogger(),
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

export function vitePluginVirtualIndexHtml(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: vitePluginVirtualIndexHtml.name,
    configureServer(server_) {
      server = server_;
    },
    resolveId(source, _importer, _options) {
      return source === "virtual:index-html" ? "\0" + source : undefined;
    },
    async load(id, _options) {
      if (id === "\0" + "virtual:index-html") {
        let html: string;
        if (server) {
          this.addWatchFile("index.html");
          html = await fs.promises.readFile("index.html", "utf-8");
          html = await server.transformIndexHtml("/", html);
        } else {
          html = await fs.promises.readFile("dist/client/index.html", "utf-8");
        }
        return `export default ${JSON.stringify(html)}`;
      }
      return;
    },
  };
}
