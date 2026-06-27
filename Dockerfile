FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY services/core-api ./services/core-api

RUN npm install

EXPOSE 8080

CMD ["npm", "run", "start"]
