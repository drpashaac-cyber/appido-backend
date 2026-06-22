# Build stage
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/core-api/dist ./services/core-api/dist
COPY --from=builder /app/packages ./packages
COPY package*.json ./

EXPOSE 8080
CMD ["npm", "run", "start"]
