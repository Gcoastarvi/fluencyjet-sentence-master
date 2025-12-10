#!/bin/bash
set -e

# Use Replit-assigned port or default to 8080
export PORT=${PORT:-8080}
echo "▶ Using Replit-assigned port: $PORT"

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
