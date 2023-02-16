#!/usr/bin/env bash
set -eux

## Build docs report
pnpm build

## Pull out all docs
mkdir -p .api-docs-input
cp packages/*/api/*.api.json .api-docs-input

## Build docs
mkdir -p docs/docs/api
pnpm api-documenter markdown --input .api-docs-input --output-folder docs/docs/api

## Clean up
rm -rf .api-docs-input
