#!/bin/bash
set -euo pipefail

chown -R cloudron:cloudron /app/data
mkdir -p /app/data/workspace /run/supervisor

exec /usr/bin/supervisord -c /app/code/supervisor/supervisord.conf
