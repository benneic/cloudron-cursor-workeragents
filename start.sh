#!/bin/bash
set -euo pipefail

chown -R cloudron:cloudron /app/data
mkdir -p /app/data/workspace /run/supervisor

export AGENT_BIN="${AGENT_BIN:-/usr/local/bin/agent}"
# Older images symlink agent -> /root/.local/bin (not executable as cloudron)
if ! gosu cloudron:cloudron "$AGENT_BIN" --version >/dev/null 2>&1; then
  ver_dir="$(dirname "$(readlink -f /root/.local/bin/agent 2>/dev/null || true)")"
  if [[ -n "$ver_dir" && -d "$ver_dir" ]]; then
    mkdir -p /app/data/cursor-agent
    cp -an "${ver_dir}/." /app/data/cursor-agent/
    chmod -R a+rx /app/data/cursor-agent
    chown -R cloudron:cloudron /app/data/cursor-agent
    AGENT_BIN=/app/data/cursor-agent/cursor-agent
    export AGENT_BIN
  fi
fi

exec /usr/bin/supervisord -c /app/code/supervisor/supervisord.conf
