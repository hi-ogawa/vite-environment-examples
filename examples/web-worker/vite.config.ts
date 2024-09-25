import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

export default defineConfig((_env) => ({
  clearScreen: false,
  plugins: [react(), vitePluginWebWorkerEnvironment()],
  environments: {
    client: {
      build: {
        minify: false,
        sourcemap: true,
        outDir: "dist/client",
      },
    },
    worker: {
      resolve: {},
      build: {
        outDir: "dist/worker",
        rollupOptions: {
          input: {
            index: "/src/entry-worker",
          },
        },
      },
    },
  },

  builder: {
    async buildApp(builder) {
      await builder.build(builder.environments["client"]!);
    },
  },
}));

function vitePluginWebWorkerEnvironment(): Plugin[] {
  return [];
}
