#!/usr/bin/env bash
set -eux

# our prepack script makes the following changes we need to reverse
# - modifies the package.json, saving previous as package.json.bak
mv package.json.bak package.json
# - generates an index.d.ts file
rm -rf index.d.ts
# - swaps out the lib and dist folders, saving the main lib folder as lib.bak
mv lib dist
mv lib.bak lib