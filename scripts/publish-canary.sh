#!/bin/bash
set -eax

type=$(pnpm auto version)

# type will be 'patch', 'minor', 'major', or the empty string

# if it's the empty string, there's nothing to do, so exit
if [ -z "$type" ]; then
  echo "No changes to publish"
  exit 0
fi

project_root=$(git rev-parse --show-toplevel)

npm config set '//registry.npmjs.org/:_authToken' $NPM_TOKEN

echo "publishing canary version"
pnpm -r exec -- tsx $project_root/scripts/publish-canary-version.ts $type