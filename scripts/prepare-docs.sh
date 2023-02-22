#!/usr/bin/env bash
set -eux

pnpm typecheck

function buildMarkdown {
  pnpm typedoc \
    --plugin typedoc-plugin-markdown \
    --out docs src/index.ts \
    --excludePrivate \
    --excludeInternal \
    --readme none \
    --githubPages false \
    --entryDocument index.md \
    --enableFrontmatter true \
    --hideBreadcrumbs true
}

pushd packages/tlstate; buildMarkdown; popd
pushd packages/tlstate-react; buildMarkdown; popd

rm -rf docs/docs/tlstate docs/docs/tlstate-react

cp -r packages/tlstate/docs docs/docs/tlstate
cp -r packages/tlstate-react/docs docs/docs/tlstate-react
