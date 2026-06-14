#!/usr/bin/env bash
echo "jq:   $(command -v jq && jq --version 2>&1 || echo MISSING)"
echo "node: $(command -v node && node --version 2>&1 || echo MISSING)"
echo "npm:  $(command -v npm && npm --version 2>&1 || echo MISSING)"
echo "rsync:$(command -v rsync && echo ok || echo MISSING)"
echo "--- containers ---"
docker ps --format '{{.Names}}\t{{.Status}}'
