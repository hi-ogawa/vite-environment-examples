# vue-ssr-extra

https://vite-environment-examples-vue-ssr-extra.hiro18181.workers.dev

Vue SSR application running on Vite Workerd dev environment.

Built on

- `vue-router`
- `pinia`
- `"use server"` convention

```sh
# development on Miniflare
pnpm dev

# preview on wrangler
pnpm build
pnpm preview

# deploy to cloudflare workers
pnpm release
```

## references

- Original `@hiogawa/react-server` starter demo https://github.com/hi-ogawa/vite-plugins/tree/main/packages/react-server/examples/starter
- Basic Vite + Vue SSR approach inspired by https://github.com/frandiox/vite-ssr
- progressive enhancement API inspired by https://kit.svelte.dev/docs/form-actions#progressive-enhancement
