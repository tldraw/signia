#!/usr/bin/env bash
set -eux

pnpm concurrently --kill-others \
  --names "prepare,docusaurus" \
  "pnpm chokidar 'packages/*/src/**/*' -c './scripts/prepare-docs.sh' --initial" \
  "pnpm --filter docs run start"