FROM node:20-alpine AS builder

WORKDIR /app

# کپی package.json اصلی
COPY package*.json ./

# کپی package.json هر workspace به صورت جداگانه
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/authz/package.json packages/authz/
COPY packages/crypto/package.json packages/crypto/
COPY packages/ai/package.json packages/ai/
COPY packages/analytics/package.json packages/analytics/
COPY packages/payments/package.json packages/payments/
COPY packages/telegram/package.json packages/telegram/
COPY services/core-api/package.json services/core-api/

# نصب وابستگی‌ها (بدون --workspaces)
RUN npm install

# نصب turbo به صورت سراسری
RUN npm install -g turbo

# کپی بقیه کد
COPY . .

# Build
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "run", "start"]