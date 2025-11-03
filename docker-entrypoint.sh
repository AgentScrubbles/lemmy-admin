#!/bin/sh
# docker-entrypoint.sh - Entrypoint script for the frontend container

set -e

echo "Starting Lemmy Admin Frontend..."
echo "Generating runtime environment configuration..."

# Generate runtime config
/env.sh

echo "Starting nginx..."
exec nginx -g "daemon off;"
