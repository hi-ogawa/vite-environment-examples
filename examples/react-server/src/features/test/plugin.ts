import type { Plugin } from "vite";
import { $__global } from "../../global";

export function vitePluginTestReactServerStream(): Plugin {
  const prefix = "virtual:test-react-server-stream/";

  return {
    name: vitePluginTestReactServerStream.name,
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
  };
}

async function testRender(page: string) {
  const runner = $__global.reactServerRunner;
  const entryMod = await runner.import("/src/entry-react-server");
  const pageMod = await runner.import(page);
  const stream = entryMod.testRender(pageMod.default);
  return stream;
}
