# workerd-cli

```sh
$ pnpm cli
[mf:inf] Ready on http://127.0.0.1:44031

> env.kv.list()
{ keys: [], list_complete: true, cacheStatus: null }

> env.kv.put("hello", "world")

> env.kv.list()
{ keys: [ { name: 'hello' } ], list_complete: true, cacheStatus: null }

> env.kv.get("hello")
world

> (await import("/wrangler.toml?raw")).default
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
kv_namespaces = [
  { binding = "kv", id = "test-namespace" }
]
```
