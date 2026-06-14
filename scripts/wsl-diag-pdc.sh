#!/usr/bin/env bash
echo "=== peer0.contractor recent private-data / endorse errors ==="
docker logs peer0.contractor.safechain.com 2>&1 | grep -iE 'private|collection|transient|endors.*fail|VSCC|MSP.*member|chaincode response 500' | tail -15
echo
echo "=== contractor ccaas container recent logs ==="
docker logs peer0contractor_safechain_ccaas 2>&1 | grep -iE 'error|private|collection|transient' | tail -10
