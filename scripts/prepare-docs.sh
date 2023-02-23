#!/usr/bin/env bash
set -eux

# The types need to be built before the docs can be generated
# because typedoc doesn't support composite ts projects
pnpm typecheck

pnpm typedoc \
  --plugin typedoc-plugin-markdown \
  --plugin typedoc-plugin-resolve-crossmodule-references \
  --out docs/docs/API \
  --excludePrivate \
  --excludeInternal \
  --excludeExternals \
  --readme none \
  --githubPages false \
  --entryDocument index.md \
  --enableFrontmatter true \
  --hideBreadcrumbs true \
  --entryPointStrategy "packages" \
  --entryPoints packages/signia \
  --entryPoints packages/signia-react \
  --entryPoints packages/signia-react-jsx

# typedoc generates this useless index file
rm -rf docs/docs/API/index.md