#!/usr/bin/env bash
CAL="$HOME/safechain/caliper"
echo "=== report-full.html var mi? ==="
ls -la "$CAL/report-full.html" 2>/dev/null || echo "YOK (bench bitmedi ya da rapor uretilmedi)"
echo
echo "=== results klasoru (mnt/d) ==="
ls -la /mnt/d/Dev/simulation_blockchain/caliper/results/ 2>/dev/null || echo "results bos"
echo
echo "=== herhangi bir node/caliper sureci ==="
pgrep -af node | head -5 || echo "node sureci yok"
echo
echo "=== WSL saati vs Windows ==="; date "+WSL: %Y-%m-%d %H:%M:%S %z"
echo
echo "=== peer son 3 commit zaman damgasi ==="
docker logs peer0.contractor.safechain.com 2>&1 | grep "Committed block" | tail -3 | grep -oE '2026[^ ]+ [0-9:]+ UTC' | tail -3