#!/usr/bin/env bash
set -eu

label=`npx auto label`

# fail if label is empty
if [ -z "$label" ]; then
	echo "No semver label found"
	echo "Please add one or more of the following labels to this PR"
	echo ""
	echo "  [patch] - for a bug fix"
	echo "  [minor] - for an improvement"
	echo "  [major] - for a breaking change"
	echo ""
	echo "  [internal] - Does not affect the published packages"
	echo ""
	echo "  [release] - Creates a release when this PR is merged"

	exit 1
fi