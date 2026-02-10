#!/bin/sh
set -e

# Start the backend server in the background
cd /app
node backend/dist/server.js &

# Start nginx in the foreground
nginx -g "daemon off;"
