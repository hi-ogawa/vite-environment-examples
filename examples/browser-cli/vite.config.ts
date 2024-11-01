import { defineConfig } from "vite";

export default defineConfig((_env) => ({
  clearScreen: false,
  environments: {
    custom: {
      optimizeDeps: {
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
        ],
        esbuildOptions: {
          platform: "browser",
          banner: undefined,
        },
      },
    },
  },
}));
