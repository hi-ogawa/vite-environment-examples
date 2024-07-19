import { createServer } from "vite";

async function main() {
  const server = await createServer({
    configFile: false,
    root: import.meta.dirname,
    plugins: [],
    ssr: {
      noExternal: ["test-dep-cjs"],
      optimizeDeps: {
        include: ["test-dep-cjs"],
      },
    },
  });
  await server.pluginContainer.buildStart({});

  // `listen` is required for ssr deps optimization
  // await server.listen();

  const mod = await server.ssrLoadModule("/entry");
  console.log(mod);

  await server.close();
}

main();
