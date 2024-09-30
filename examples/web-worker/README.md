# web-worker

```sh
pnpm dev
pnpm build
pnpm preview
```

## Why

This approach can potentially solve following issues:

- resolve `worker` conditions both during dev and build (cf. https://github.com/vitejs/vite/issues/7439)
- multiple esm workers sharing code split chunks (cf. https://github.com/vitejs/vite/issues/18068)
- [`worker`](https://vitejs.dev/config/worker-options.html#worker-options) options can be integrated into `environments.worker` options and plugins run more consistently during dev and build.

## How it works

Example code:

```ts
import workerUrl from "./worker.ts?worker-env";
const worker = new Worker(workerUrl, { type: "module" });
```

__Transform during dev__

```ts
//// transform of /path-to/worker.ts?worker-env
export default "/path-to/worker.ts?worker-env-file";
```

```ts
//// transform of /path-to/worker.ts?worker-env-file
import { createFetchRunner } from "/src/lib/runner";
const runner = createFetchRunner({ root: "...", environmentName: "worker" });
runner.import("/path-to/worker.ts");
```

__Transform during build__

This plugin orchestrates a following build steps:

- client `buildEnd` kicks off worker `buildStart`
  - worker build starts with `emitFile` of worker references from client.
- worker `generateBundle` kicks off client `renderChunk`:
  - `__VITE_WORKER_URL_PLACEHOLDER["<entry>"]` inside client chunk is replaced with actual worker build's output url.

```ts
//// transform of /path-to/worker.ts?worker-env
export default "/path-to-emitted-chunk/worker-xxyyzzww.js";
```

## TODO

- only esm can support multi worker entries. what to do with iife?
- optimizeDeps
- hmr
- resolve conditions bug https://github.com/vitejs/vite/issues/18222

## Related

- https://github.com/vitejs/vite/discussions/18191
- https://github.com/vitejs/vite/issues/7439
- https://github.com/vitejs/vite/issues/18068
