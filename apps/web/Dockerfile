# IBIS-X v2 — frontend Next.js 16.
# Stage `dev` : hot reload (docker-compose.yml) ; stage `prod` : build optimisé (compose.prod.yml).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS prod
ENV NODE_ENV=production
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
