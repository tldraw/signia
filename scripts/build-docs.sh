#!/usr/bin/env bash
set -eux

## Build docs report
pnpm build

## Pull out all docs
mkdir -p docs/api-input
cp packages/*/api/*.api.json docs/api-input

## Build docs
pnpm run api-documenter markdown --input docs/api-input --output-folder docs/api

## Clean up
rm -rf docs/api-input
