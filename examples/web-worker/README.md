# web-worker

```sh
pnpm dev
pnpm build
pnpm preview
```

## how it works

```ts
import workerUrl from "./worker.ts?worker-env";
const worker = new Worker(workerUrl, { type: "module" });
```

## during dev

```ts
// /path-to/worker.ts?worker-env
export default "/path-to/worker.ts?worker-env-file";
```

```ts
// /path-to/worker.ts?worker-env-file
import { createFetchRunner } from "/src/lib/runner";
const runner = createFetchRunner({ root: "...", environmentName: "worker" });
runner.import("/path-to/worker.ts");
```

## during build

TODO

## tbd

- need parallel client/worker build to avoid extra client build for discovering worker references
- only esm supports multi worker entries

## related

- https://github.com/vitejs/vite/discussions/18191
- https://github.com/vitejs/vite/issues/7439
