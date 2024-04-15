import { tinyassert } from "@hiogawa/utils";
import type { ModuleRunner } from "vite/module-runner";

export const RUNNER_INIT_PATH = "/__viteInit";
export const RUNNER_EVAL_PATH = "/__viteEval";
export const ANY_URL = "https://any.local";

export type RunnerEnv = {
  __viteRoot: string;
  __viteUnsafeEval: {
    eval: (code: string, filename?: string) => any;
  };
  __viteFetchModule: {
    fetch: (request: Request) => Promise<Response>;
  };
  __viteRunner: DurableObject;
};

export type RunnerFetchOptions = {
  entry: string;
};

const FETCH_OPTIONS_KEY = "__viteFetchOptions";

export function setRunnerFetchOptions(
  headers: Headers,
  options: RunnerFetchOptions,
): Headers {
  headers.set(FETCH_OPTIONS_KEY, encodeURIComponent(JSON.stringify(options)));
  return headers;
}

export function getRunnerFetchOptions(headers: Headers): RunnerFetchOptions {
  const raw = headers.get(FETCH_OPTIONS_KEY);
  tinyassert(raw);
  return JSON.parse(decodeURIComponent(raw));
}

export type EvalFn<In = any, Out = any> = (ctx: {
  mod: any;
  data: In;
  env: any;
  runner: ModuleRunner;
}) => Promise<Out> | Out;

export type EvalApi = <In = any, Out = any>(request: {
  entry: string;
  fn: EvalFn<In, Out>;
  data: In;
}) => Promise<Awaited<Out>>;

export type EvalMetadata = {
  entry: string;
  fnString: string;
};
