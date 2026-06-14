#!/usr/bin/env bash
echo "=== nodeenv / ccenv images present? ==="
docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'nodeenv|ccenv' || echo "NONE"
echo
echo "=== peer0.org1 last build-related logs ==="
docker logs peer0.org1.example.com 2>&1 | grep -iE 'build|docker|chaincode|error|broken' | tail -25
echo
echo "=== docker server API version ==="
docker version --format 'API {{.Server.APIVersion}} (min {{.Server.MinAPIVersion}})'
