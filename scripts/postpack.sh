#!/usr/bin/env bash
set -eux

# our prepack script modifies the package.json and generates an index.d.ts file
# so let's undo those changes after packing
mv package.json.bak package.json
rm -rf index.d.ts