FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build
RUN yarn prisma:generate

EXPOSE 3000

CMD ["sh", "-c", "yarn prisma:deploy && node dist/server.js"]
