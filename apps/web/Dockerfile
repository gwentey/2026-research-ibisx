# IBIS-X v2 — frontend Next.js 16 (dev : hot reload ; le stage prod arrive au J9)
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["pnpm", "dev"]
