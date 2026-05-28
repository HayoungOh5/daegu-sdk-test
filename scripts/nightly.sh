#!/bin/bash
# Intended to be invoked once a day from cron, e.g.:
#   0 3 * * * /path/to/daegu-sdk-test/scripts/nightly.sh dev,30000 >> /path/to/daegu-sdk-test/test/0_summary/cron.log 2>&1
#
# Each run appends to test/0_metrics/latency_<network>.csv so latency vs.
# accumulated block height can be charted over time.
set -e
cd "$(dirname "$0")/.."
ARG="${1:-dev,30000}"

echo "=== nightly $(date -Iseconds) arg=$ARG ==="
./scripts/test.sh "$ARG" || echo "test.sh exited with code $?"
echo "=== done $(date -Iseconds) ==="
