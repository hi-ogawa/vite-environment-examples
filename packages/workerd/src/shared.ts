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

export type RunnerEvalOptions = {
  entry: string;
  fnString: string;
  args: unknown[];
};

export type RunnerEvalContext = {
  env: any;
  runner: ModuleRunner;
  exports: Record<string, any>;
  args: any[];
};

export type RunnerEvalFn = (ctx: RunnerEvalContext) => Promise<any> | any;

// TODO: customize encoding
export async function encodeEvalRequest(options: RunnerEvalOptions) {
  return {
    headers: {
      "x-vite-eval-metadata": JSON.stringify({
        entry: options.entry,
        fnString: options.fnString,
      }),
    },
    body: JSON.stringify(options.args),
  } satisfies RequestInit;
}

export async function decodeEvalRequest(
  request: Request,
): Promise<RunnerEvalOptions> {
  const meta = JSON.parse(request.headers.get("x-vite-eval-metadata")!);
  return {
    entry: meta.entry,
    fnString: meta.fnString,
    args: await request.json(),
  };
}

export async function encodeEvalResponse(result: unknown) {
  return new Response(JSON.stringify({ result }));
}

export async function decodeEvalResponse(response: Response) {
  tinyassert(response.ok);
  const resJson = await response.json<any>();
  return resJson.result;
}
