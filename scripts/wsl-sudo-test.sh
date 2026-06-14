#!/usr/bin/env bash
echo "whoami: $(whoami)"
if sudo -n true 2>/dev/null; then
  echo "SUDO: passwordless OK"
else
  echo "SUDO: needs password"
fi
# show any hung apt/sudo from previous run
echo "--- apt/sudo processes ---"
ps -eo pid,comm 2>/dev/null | grep -E 'apt|sudo|dpkg' || echo "none"
