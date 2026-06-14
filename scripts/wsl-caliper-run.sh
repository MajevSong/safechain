#!/usr/bin/env bash
# Run a Caliper benchmark against the SafeChain network.
# Usage: bash wsl-caliper-run.sh [quick|full]
set -e
BENCH="${1:-quick}"
export PATH="$HOME/.local/bin:$PATH"

SRC="/mnt/d/Dev/simulation_blockchain/caliper"
CAL="$HOME/safechain/caliper"

echo "=== sync caliper configs/workloads into $CAL ==="
mkdir -p "$CAL/workload" "$CAL/benchmarks"
rsync -a "$SRC/networkConfig.yaml" "$SRC/ccp-contractor.yaml" "$CAL/"
rsync -a --delete "$SRC/workload/" "$CAL/workload/"
rsync -a --delete "$SRC/benchmarks/" "$CAL/benchmarks/"

cd "$CAL"
REPORT="report-${BENCH}.html"
mkdir -p "$SRC/results"
LOG="$SRC/results/${BENCH}.log"
echo "=== caliper launch manager (benchmark: $BENCH) -> live log: $LOG ==="
# Write full output to a live log file (no tail buffering) so progress is visible.
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networkConfig.yaml \
  --caliper-benchconfig "benchmarks/safechain-${BENCH}.yaml" \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled \
  --caliper-report-path "$REPORT" > "$LOG" 2>&1

echo "=== DONE. report: $CAL/$REPORT ==="
cp -f "$CAL/$REPORT" "$SRC/results/" 2>/dev/null || true
echo "BENCHMARK_COMPLETE"
