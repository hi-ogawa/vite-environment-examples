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

__transform during dev__

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

__transform during build__

Build pipeline (notably it requires building client twice):

- 1st client build: discover `./worker.ts?worker-env` imports,
- worker build: `emitFile({ type: "chunk", id: "/path-to/worker.ts" })` for discovered `?worker-env` imports,
- 2nd client build: transform `./worker.ts?worker-env` using worker build chunks,

```ts
//// transform of /path-to/worker.ts?worker-env
export default "/path-to-emitted-chunk/worker-xxyyzzww.js";
```

## TBD

- need parallel client/worker build to avoid extra client build for discovering worker references
- only esm supports multi worker entries
- optimizeDeps
- hmr
- resolve conditions bug https://github.com/vitejs/vite/issues/18222

## Related

- https://github.com/vitejs/vite/discussions/18191
- https://github.com/vitejs/vite/issues/7439
- https://github.com/vitejs/vite/issues/18068
