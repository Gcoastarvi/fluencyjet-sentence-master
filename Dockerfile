# ---------- Build client ----------
FROM node:22-alpine AS client-build
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client .
RUN npm run build

# ---------- Build server ----------
FROM node:22-alpine AS server-build
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server .
RUN npm run build || true

# ---------- Runtime ----------
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

# server deps
COPY --from=server-build /app/server /app/server

# frontend build → server/dist/public
COPY --from=client-build /app/client/dist /app/server/dist/public

WORKDIR /app/server

EXPOSE 8080
CMD ["node", "index.js"]
