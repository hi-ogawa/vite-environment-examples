#!/bin/bash
set -eu -o pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# clean
rm -rf dist
mkdir -p dist/server dist/client

# static
cp -r ../../dist/client/. dist/client
rm -rf dist/client/index.html

# server (bundle by ourselve instead of relying on wrangler)
npx esbuild ../../dist/ssr/index.js \
  --outfile=dist/ssr/index.js \
  --metafile=dist/esbuild-metafile.json \
  --define:process.env.NODE_ENV='"production"' \
  --log-override:ignored-bare-import=silent \
  --bundle \
  --minify \
  --format=esm \
  --platform=browser
