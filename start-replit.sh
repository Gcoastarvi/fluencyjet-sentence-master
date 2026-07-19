#!/bin/bash
set -e

# Prefer Replit-assigned port; fall back gracefully if port 3000 is taken
# by the Vite dev-frontend workflow (mapped: localPort 3005 → externalPort 3000).
if fuser 3000/tcp >/dev/null 2>&1; then
  export PORT=3005
  echo "▶ Port 3000 in use — starting on port 3005 (external port 3000)"
else
  export PORT=${PORT:-3000}
  echo "▶ Using port: $PORT"
fi

# Check if build exists, only build if missing
if [ ! -f "client/dist/index.html" ]; then
  echo "📦 Installing client deps…"
  npm --prefix client install --no-audit --no-fund
  echo "🏗️ Building client…"
  npm --prefix client run build
else
  echo "✓ Using existing build"
fi

# Start the production server
echo "🚀 Starting server (production mode)…"
NODE_ENV=production PORT=$PORT exec node server/index.js
