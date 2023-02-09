#!/usr/bin/env bash
set -eux

if ! "$ALLOW_DIRTY_PACK"; then
  # our prepack script modifies the package.json and generates an index.d.ts file
	# so let's undo those changes after packing
	git checkout HEAD package.json
	rm -rf index.d.ts
fi