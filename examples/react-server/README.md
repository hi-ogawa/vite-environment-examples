# react-server

Porting [`@hiogawa/react-server`](https://github.com/hi-ogawa/vite-plugins/tree/main/packages/react-server) (single process / two Vite servers)
to Vite 6 environment API (single process / single Vite server)

https://vite-environment-examples-react-server.hiro18181.workers.dev/

```sh
pnpm dev
pnpm build
pnpm preview

pnpm cf-build
pnpm cf-preview
pnpm cf-release
```

## todo

- [x] custom react-server environment
- [x] rsc stream
- [x] rsc ssr
  - [x] dev
  - [x] build
- [x] rsc csr
- [x] client reference
  - [x] dev
  - [x] build
- [x] hmr
  - [x] browser
  - [x] react-server
- [x] server action
  - [x] basic form action
  - [x] `encodeReply/decodeReply/decodeAction/decodeFormState/useActionState`
