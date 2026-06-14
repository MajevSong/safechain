#!/usr/bin/env bash
# Run only the accident round and surface the actual submit error.
set -e
export PATH="$HOME/.local/bin:$PATH"
SRC="/mnt/d/Dev/simulation_blockchain/caliper"
CAL="$HOME/safechain/caliper"
rsync -a "$SRC/networkConfig.yaml" "$SRC/ccp-contractor.yaml" "$CAL/"
rsync -a --delete "$SRC/workload/" "$CAL/workload/"

# tiny one-round benchmark
cat > "$CAL/benchmarks/_accident-only.yaml" <<'EOF'
test:
  name: accident-only
  workers:
    number: 1
  rounds:
    - label: accident-only
      txNumber: 10
      rateControl:
        type: fixed-rate
        opts: { tps: 5 }
      workload: { module: workload/reportAccident.js }
EOF

cd "$CAL"
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networkConfig.yaml \
  --caliper-benchconfig benchmarks/_accident-only.yaml \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled 2>&1 | grep -iE 'error|status code|ReportAccident|Succ|Fail' | head -20
