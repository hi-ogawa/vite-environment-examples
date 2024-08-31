import MagicString from "magic-string";
import type { Plugin } from "vite";
import { $__global } from "../../global";

export function vitePluginTestReactServerStream(): Plugin {
  const prefix = "virtual:test-react-server-stream/";

  return {
    name: vitePluginTestReactServerStream.name,
    enforce: "pre",
    resolveId(source, _importer, _options) {
      if (source.startsWith(prefix)) {
        return "\0" + source;
      }
      return;
    },
    async load(id, _options) {
      if (id.startsWith("\0" + prefix)) {
        const page = id.slice(prefix.length);
        this.addWatchFile(page);
        const stream = await testRender(page);
        let stringified = "";
        await stream.pipeThrough(new TextDecoderStream()).pipeTo(
          new WritableStream({
            write(chunk) {
              stringified += chunk;
            },
          }),
        );
        const code = `
          export default new ReadableStream({
            start(controller) {
              controller.enqueue(${JSON.stringify(stringified)});
              controller.close();
            }
          }).pipeThrough(new TextEncoderStream());
        `;
        return code;
      }
      return;
    },
    transform(code) {
      // Workaround module runner `import.meta.env` usage inside Vitest
      //   Error: [module runner] Dynamic access of "import.meta.env" is not supported. Please, use "import.meta.env.DEV" instead.
      if (code.includes("import.meta.env.DEV")) {
        const output = new MagicString(code);
        for (const match of code.matchAll(/\bimport\.meta\.env\.DEV\b/dg)) {
          const [start, end] = match.indices![0];
          output.update(start, end, "true");
        }
        if (output.hasChanged()) {
          return { code: output.toString(), map: output.generateMap() };
        }
      }
      return;
    },
  };
}

async function testRender(page: string) {
  const runner = $__global.reactServerRunner;
  const entryMod = await runner.import("/src/entry-server");
  const pageMod = await runner.import(page);
  const stream = entryMod.testRender(pageMod.default);
  return stream;
}
