# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files first for caching
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install deps
RUN cd client && npm ci
RUN cd server && npm ci

# Copy source
COPY client ./client
COPY server ./server

# Build client and copy to server dist/public
RUN cd server && npm run build

# ---------- Run stage ----------
FROM node:22-alpine AS run
WORKDIR /app

# Only server runtime deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server code + built dist from build stage
COPY --from=build /app/server /app/server

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "index.js"]
