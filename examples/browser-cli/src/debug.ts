import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type Plugin } from "vite";

async function main() {
  const server = await createServer({
    clearScreen: false,
    configFile: false,
    appType: "custom",
    root: fileURLToPath(new URL("..", import.meta.url)),
    environments: {
      custom: {
        nodeCompatible: false,
        webCompatible: true,
        resolve: {
          noExternal: true,
        },
      },
    },
    server: {
      watch: null,
    },
    ssr: {
      target: "webworker",
    },
    plugins: [
      createVirtualPlugin("test.tsx", () => {
        // virtual module doesn't go through esbuild transform?
        return `export default <div /> as any;`;
      }),
    ],
    // esbuild: {
    //   include: /.*/
    // }
  });
  await server.pluginContainer.buildStart({});

  {
    const result = await transformWithEsbuild(
      `export default <div /> as any;`,
      "virtual:test.tsx",
    );
    console.log(result);
  }

  {
    // const result = await transformWithEsbuild(`export default <div /> as any;`, "");
    // console.log(result);
  }

  // {
  //   const result = await server.transformRequest("virtual:test.tsx");
  //   console.log(result);
  // }
  {
    const result =
      await server.environments.client.transformRequest("virtual:test.tsx");
    console.log(result);
  }
  // {
  //   const result = await server.environments.client.transformRequest("/src/test.tsx");
  //   console.log(result);
  // }
  // server.environments.ssr.transformRequest;
}

function createVirtualPlugin(name: string, load: Plugin["load"]) {
  name = "virtual:" + name;
  return {
    name: `virtual-${name}`,
    resolveId(source, _importer, _options) {
      return source === name ? "\0" + name : undefined;
    },
    load(id, options) {
      if (id === "\0" + name) {
        return (load as any).apply(this, [id, options]);
      }
    },
  } satisfies Plugin;
}

main();
