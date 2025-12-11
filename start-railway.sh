#!/bin/bash
set -e
export PORT=${PORT:-8080}

echo "🌍 Railway Production Startup"
echo "📦 Installing client deps…"
npm --prefix client ci --omit=dev

echo "🏗️ Building optimized client build…"
npm --prefix client run build

echo "🚀 Starting production server on Railway..."
NODE_ENV=production PORT=$PORT node server/index.js
