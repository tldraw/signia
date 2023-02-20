
#!/usr/bin/env bash
set -eux

./scripts/prepare-docs.sh

pnpm --filter docs run build-docs