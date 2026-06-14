#!/usr/bin/env bash
# Emulate WAN latency on the ordering tier (netem) and benchmark the effect on
# RegisterCertificate throughput/latency. Uses a netshoot sidecar sharing each
# orderer's network namespace (no orderer reconfiguration needed).
set -e
DELAY="${1:-20ms}"
export PATH="$HOME/.local/bin:$PATH"
ORDS="orderer.safechain.com orderer2.safechain.com orderer3.safechain.com"

echo "=== ensure netshoot image ==="
docker image inspect nicolaka/netshoot >/dev/null 2>&1 || docker pull nicolaka/netshoot >/dev/null 2>&1
echo "netshoot ready"

netem(){ # action(add|del) delay
  for o in $ORDS; do
    if [ "$1" = "add" ]; then
      docker run --rm --net "container:$o" --cap-add NET_ADMIN nicolaka/netshoot \
        tc qdisc add dev eth0 root netem delay "$2" >/dev/null 2>&1 && echo "  +$2 on $o" || echo "  FAILED on $o"
    else
      docker run --rm --net "container:$o" --cap-add NET_ADMIN nicolaka/netshoot \
        tc qdisc del dev eth0 root >/dev/null 2>&1 && echo "  cleared $o" || true
    fi
  done
}

echo "=== inject $DELAY latency on all 3 orderers ==="
netem add "$DELAY"
sleep 3

echo "=== benchmark RegisterCertificate @100 TPS with $DELAY ordering-tier latency ==="
export RUN_PREFIX="netem$(echo $DELAY | tr -d 'ms')"
bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-caliper-run.sh endorse >/dev/null 2>&1 || true
cp -f "$HOME/safechain/caliper/report-endorse.html" "/mnt/d/Dev/simulation_blockchain/caliper/results/report-netem-$DELAY.html" 2>/dev/null || true
echo "--- result @$DELAY ---"
bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-show-report.sh "$HOME/safechain/caliper/report-endorse.html" 2>/dev/null | head -1

echo "=== remove netem ==="
netem del
echo "NETEM_DONE"
