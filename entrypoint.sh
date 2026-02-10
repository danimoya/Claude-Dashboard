#!/bin/sh
set -e

cd /app

# Try starting backend and capture any errors
node backend/dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Give backend a moment to start
sleep 3

# Check if backend is still running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend failed to start. Logs:" >&2
    cat /tmp/backend.log >&2
    exit 1
fi

echo "Backend started (PID: $BACKEND_PID)"

# Start nginx in the foreground
exec nginx -g "daemon off;"
