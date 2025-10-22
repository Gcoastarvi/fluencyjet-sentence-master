#!/bin/bash
set -e

echo "🧹 Cleaning up old processes on port 8080..."
# Replit doesn’t have lsof, so use pkill instead
pkill -f "server/index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

export PORT=${PORT:-8080}
echo "▶ Using Replit-assigned port: $PORT"

echo "📦 Installing client deps (if missing)…"
# Only install client dependencies if not already installed
if [ ! -d "client/node_modules" ]; then
  npm --prefix client install --no-audit --no-fund
else
  echo "✅ Client dependencies already installed."
fi

echo "🏗️ Building client…"
npm --prefix client run build

echo "🚀 Starting local dev server for Replit Preview…"
NODE_ENV=development PORT=$PORT node server/index.js
