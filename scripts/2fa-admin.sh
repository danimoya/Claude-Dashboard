#!/usr/bin/env bash
# Host-side wrapper that forwards to the container's 2fa-admin script.
#
#   2fa-admin.sh status  <username>
#   2fa-admin.sh disable <username>
#   2fa-admin.sh reset   <username>   # alias of disable
#
# Relies on the claude-dashboard container being up. The script is mounted
# at /app/scripts inside the container.
set -euo pipefail

CONTAINER="${CLAUDE_DASHBOARD_CONTAINER:-claude-dashboard}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container '$CONTAINER' is not running." >&2
  exit 1
fi

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <status|disable|reset> <username>" >&2
  exit 2
fi

exec docker exec -i "$CONTAINER" node /app/scripts/2fa-admin.mjs "$@"
