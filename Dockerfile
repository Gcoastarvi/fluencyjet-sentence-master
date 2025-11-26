# -------------------------
# 1. Build React client
# -------------------------
FROM node:22 AS client-build

WORKDIR /app
COPY client ./client
COPY package*.json ./

RUN cd client && npm ci && npm run build


# -------------------------
# 2. Build server
# -------------------------
FROM node:22 AS server-build

WORKDIR /app

# Copy backend files
COPY server ./server
COPY package*.json ./

RUN npm ci --only=production


# -------------------------
# 3. Final runtime image
# -------------------------
FROM node:22

WORKDIR /app

# Copy server build + client dist
COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/dist ./client/dist
COPY package*.json ./ 

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server/index.js"]
