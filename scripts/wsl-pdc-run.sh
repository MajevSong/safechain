#!/usr/bin/env bash
# PDC overhead run with a unique key namespace to avoid collisions with prior runs.
export RUN_PREFIX=pdc2
bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-caliper-run.sh pdc
