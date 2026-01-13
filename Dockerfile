# ---------- Build client ----------
FROM node:22-alpine AS build
WORKDIR /app

# client deps
COPY client/package*.json ./client/
RUN cd client && npm ci

# client source + build
COPY client ./client
RUN cd client && npm run build

# ---------- Runtime (server) ----------
FROM node:22-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production

# server deps
COPY server/package*.json ./
RUN npm ci --omit=dev

# server source
COPY server ./

# prisma client
RUN npx prisma generate

# copy built frontend into server/dist/public
RUN rm -rf dist && mkdir -p dist/public
COPY --from=build /app/client/dist ./dist/public

EXPOSE 8080
CMD ["node", "index.js"]
