#!/bin/bash
set -eu -o pipefail

# workerd environment
pnpm -C examples/react-ssr-workerd test-e2e

# react server environment
pnpm -C examples/react-server test-e2e
pnpm -C examples/react-server build
pnpm -C examples/react-server test-e2e-preview
