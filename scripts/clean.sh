#!/usr/bin/env bash
set -eux

rm -rf node_modules .turbo
rm -rf **/*/node_modules
rm -rf **/*/.tsbuild
rm -rf **/*/tsconfig.build.json
rm -rf **/*/.turbo
rm -rf **/*/*.tsbuildinfo
rm -rf packages/*/api
rm -rf packages/*/dist
rm -rf packages/*/*.tgz
pnpm install
