import { fileURLToPath } from "url";
import {
  createServer,
} from "vite";

// npx tsx examples/custom/src/optimize-deps/runner-ssr.ts

const server = await createServer({
  clearScreen: false,
  configFile: false,
  root: fileURLToPath(new URL(".", import.meta.url)),
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
    noExternal: ["react", "react-server-dom-webpack"],
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-server-dom-webpack/server.edge",
      ],
    },
  },
});

const mod = await server.ssrLoadModule("/entry");
await mod["default"]();

await server.close();
