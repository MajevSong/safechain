#!/usr/bin/env bash
# Run the centralized baseline benchmark (no blockchain). Pure Node, no Fabric.
set -e
export PATH="$HOME/.local/bin:$PATH"
B="/mnt/d/Dev/simulation_blockchain/baseline"
node "$B/server.js" & SRV=$!
sleep 1
echo "=== centralized baseline (in-memory REST) ==="
for kind in register signed query accident; do
  for tps in 100 500 1000; do
    node "$B/loadtest.js" "$kind" "$tps" 30
  done
done
kill $SRV 2>/dev/null || true
echo "BASELINE_DONE"
