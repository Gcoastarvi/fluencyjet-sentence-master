#!/bin/bash
set -e

# Use Replit-assigned port or default to 8080
export PORT=${PORT:-8080}
echo "▶ Using Replit-assigned port: $PORT"

# Install client dependencies if needed
echo "📦 Installing client deps (if missing)…"
[ -d client/node_modules ] || npm --prefix client install --no-audit --no-fund

# Build the client
echo "🏗️ Building client…"
npm --prefix client run build

# Start the production server
echo "🚀 Starting server (production mode)…"
NODE_ENV=production PORT=$PORT node server/index.js
