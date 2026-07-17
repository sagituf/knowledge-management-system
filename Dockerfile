# ---- Stage 1: build the client ----
FROM node:24-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Stage 2: runtime (server + built client) ----
# node:24-slim: node:sqlite (DatabaseSync) is available without an experimental
# flag from Node 24 onward. Do not downgrade to node:22 — it requires
# --experimental-sqlite and the app would fail to open the database at runtime.
FROM node:24-slim AS runtime
WORKDIR /app

# server deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci

# server source + built client
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

ENV PORT=3000
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000

# Run as the non-root `node` user (built into node:*-slim images). /data and
# /app must be writable by it first, since VOLUME/COPY above create them as root.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

WORKDIR /app/server
CMD ["npm", "start"]
