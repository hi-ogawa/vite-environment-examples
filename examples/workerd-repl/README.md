# workerd-repl

```sh
$ pnpm repl

> (await import("/wrangler.toml?raw")).default
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
kv_namespaces = [
  { binding = "kv", id = "test-namespace" }
]

> env.kv.list()
{ keys: [], list_complete: true, cacheStatus: null }

> env.kv.put("hello", "world")

> env.kv.list()
{ keys: [ { name: 'hello' } ], list_complete: true, cacheStatus: null }

> env.kv.get("hello")
world
```
