#!/bin/bash
set -eu -o pipefail

# web worker environment
pnpm -C examples/web-worker test-e2e
pnpm -C examples/web-worker build
pnpm -C examples/web-worker test-e2e-preview
