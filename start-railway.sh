#!/bin/bash

echo "Starting FluencyJet backend..."
cd server

echo "Running migrations..."
npx prisma migrate deploy

echo "Starting server..."
node index.js
