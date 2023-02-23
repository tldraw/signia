#!/usr/bin/env bash
set -eux

./scripts/prepare-docs.sh

pnpm concurrently --kill-others \
  --names "typedoc,docusaurus" \
  "pnpm chokidar 'packages/*/src/**/*' -c './scripts/prepare-docs.sh'" \
  "pnpm --filter docs run start"