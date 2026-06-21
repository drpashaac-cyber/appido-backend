# syntax=docker/dockerfile:1
# ---- build: install deps, compile the monorepo, then drop dev deps ----
FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build && npm prune --omit=dev

# ---- run: slim, non-root, signal-safe ----
FROM node:20-slim AS run
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "services/core-api/dist/main.js"]
