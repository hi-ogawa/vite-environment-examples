# repro

```sh
$ pnpm -C examples/repro repro

> @hiogawa/vite-environment-examples-repro@ repro /home/hiroshi/code/personal/vite-environment-examples/examples/repro
> tsx src/repro.ts

6:00:18 PM [vite] (ssr) Error when evaluating SSR module /entry:
|- ReferenceError: module is not defined
    at eval (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/test-deps-cjs@file+examples+repro+test-dep-cjs/node_modules/test-deps-cjs/index.js:1:8)
    at ESModulesEvaluator.runInlinedModule (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:1007:6)
    at ModuleRunner.directRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:980:82)
    at ModuleRunner.cachedRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:895:28)
    at request (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:930:116)
    at async eval (/home/hiroshi/code/personal/vite-environment-examples/examples/repro/src/entry.js:3:44)
    at ESModulesEvaluator.runInlinedModule (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:999:5)
    at ModuleRunner.directRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:980:61)
    at ModuleRunner.cachedRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:896:76)
    at ModuleRunner.import (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:843:12)

node:internal/process/promises:289
            triggerUncaughtException(err, true /* fromPromise */);
            ^

ReferenceError: module is not defined
    at eval (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/test-deps-cjs@file+examples+repro+test-dep-cjs/node_modules/test-deps-cjs/index.js:1:8)
    at ESModulesEvaluator.runInlinedModule (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:1007:6)
    at ModuleRunner.directRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:980:82)
    at ModuleRunner.cachedRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:895:28)
    at request (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:930:116)
    at async eval (/home/hiroshi/code/personal/vite-environment-examples/examples/repro/src/entry.js:3:44)
    at ESModulesEvaluator.runInlinedModule (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:999:5)
    at ModuleRunner.directRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:980:61)
    at ModuleRunner.cachedRequest (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:896:76)
    at ModuleRunner.import (/home/hiroshi/code/personal/vite-environment-examples/node_modules/.pnpm/vite@6.0.0-alpha.18_@types+node@20.14.11_terser@5.31.3/node_modules/vite/dist/node/module-runner.js:843:12)

Node.js v20.12.0
 ELIFECYCLE  Command failed with exit code 1.

```
