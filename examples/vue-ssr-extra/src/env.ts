import type { KVNamespace } from "@cloudflare/workers-types";

export let env: {
  kv: KVNamespace;
  SLOW_MO: number;
};

export function setEnv(env_: typeof env) {
  env = env_;
}
