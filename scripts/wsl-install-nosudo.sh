#!/usr/bin/env bash
# Install jq + Node.js into ~/.local WITHOUT sudo (user has no passwordless sudo).
set -e

# Release the hung sudo from the earlier attempt (harmless, but tidy).
pkill -u "$(whoami)" -x sudo 2>/dev/null || true

mkdir -p "$HOME/.local/bin"

if ! "$HOME/.local/bin/jq" --version >/dev/null 2>&1; then
  echo "=== installing jq (static binary) ==="
  curl -fsSL https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64 \
    -o "$HOME/.local/bin/jq"
  chmod +x "$HOME/.local/bin/jq"
fi

NODE_VER=v20.18.1
NODE_DIR="$HOME/.local/node-$NODE_VER-linux-x64"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "=== installing Node.js $NODE_VER (tarball) ==="
  curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" \
    -o /tmp/node.tar.xz
  tar -xJf /tmp/node.tar.xz -C "$HOME/.local"
  ln -sf "$NODE_DIR/bin/node" "$HOME/.local/bin/node"
  ln -sf "$NODE_DIR/bin/npm"  "$HOME/.local/bin/npm"
  ln -sf "$NODE_DIR/bin/npx"  "$HOME/.local/bin/npx"
fi

# Persist PATH for future interactive shells.
if ! grep -q 'safechain PATH' "$HOME/.bashrc" 2>/dev/null; then
  echo '# safechain PATH' >> "$HOME/.bashrc"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

export PATH="$HOME/.local/bin:$PATH"
echo "=== versions ==="
echo "jq:   $(jq --version)"
echo "node: $(node --version)"
echo "npm:  $(npm --version)"
