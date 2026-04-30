FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget \
  && npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@9.15.0

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
ARG API_INTERNAL_URL=http://api:3001
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY apps/web ./apps/web
RUN pnpm --filter @music-ai/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/.npmrc ./.npmrc
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/system/health || exit 1
CMD ["pnpm", "--filter", "@music-ai/web", "start"]
