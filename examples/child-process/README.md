# child-process

Custom environment to run a module runner inside a child process (e.g. node, bun). For example, this allows externalizing `react` deps by running a child process with `--conditions react-server`.

```sh
pnpm dev
```

## todo

- write a summary
  - why bridge server instead of vite server middleware
  - `dispatchFetch(request)` vs `dispatchFetch(entry, request)`

## related

- https://github.com/netlify/netlify-vite-environment
- https://github.com/flarelabs-net/vite-environment-providers
- https://github.com/flarelabs-net/vite-plugin-cloudflare
- https://github.com/vitejs/vite/discussions/18191
