# syntax=docker/dockerfile:1
# ---- build: install deps, compile the monorepo, then drop dev deps ----
FROM node:26-slim AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build && npm prune --omit=dev

# ---- run: slim, non-root, signal-safe (no HTTP port) ----
FROM node:26-slim AS run
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "services/workers/dist/main.js"]
