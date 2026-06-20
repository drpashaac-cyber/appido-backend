FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/*/package*.json packages/*/
COPY services/*/package*.json services/*/
RUN npm install --workspaces
RUN npm install -g turbo

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "run", "start"]