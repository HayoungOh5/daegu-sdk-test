#!/bin/bash
# Run the full regression suite once. Use the network name as the last arg, e.g.:
#   ./scripts/test.sh dev,30000
set -e
cd "$(dirname "$0")/.."
ARG="${1:-local,30000}"

npx mocha --require ts-node/register --extensions ts \
  'test/**/test_*.ts' "$ARG"
