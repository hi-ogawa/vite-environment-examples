export const RUNNER_INIT_PATH = "/__viteInit";

export type RunnerEnv = {
  __viteRoot: string;
  __viteEntry: string;
  __viteUnsafeEval: {
    eval: (code: string, filename: string) => any;
  };
};
