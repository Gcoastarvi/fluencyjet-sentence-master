#!/bin/bash
set -e

# Install server dependencies
cd server
npm install --ignore-scripts

# Apply any pending Prisma migrations and regenerate the client
npx prisma migrate deploy
npx prisma generate

cd ..

# Install client dependencies
cd client
npm install --ignore-scripts
