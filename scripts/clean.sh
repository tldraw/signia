#!/usr/bin/env bash
set -eux

rm -rf node_modules
rm -rf **/*/node_modules
rm -rf **/*/.tsbuild
rm -rf **/*/*.tsbuildinfo
rm -rf packages/*/api
pnpm install
