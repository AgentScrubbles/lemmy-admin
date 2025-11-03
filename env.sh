#!/bin/sh
# env.sh - Generate runtime environment configuration for the frontend

# Recreate config.js file with environment variables
cat <<EOF > /usr/share/nginx/html/env-config.js
window.__env__ = {
  VITE_LEMMY_INSTANCE_URL: "${VITE_LEMMY_INSTANCE_URL:-https://poptalk.scrubbles.tech}",
  VITE_BACKEND_API_URL: "${VITE_BACKEND_API_URL:-http://localhost:3001}",
  VITE_OPENAI_API_URL: "${VITE_OPENAI_API_URL:-}",
  VITE_OPENAI_API_KEY: "${VITE_OPENAI_API_KEY:-}"
};
EOF

echo "Runtime environment configuration generated:"
cat /usr/share/nginx/html/env-config.js
