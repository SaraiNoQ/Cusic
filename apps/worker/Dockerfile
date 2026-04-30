FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache procps \
  && npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@9.15.0

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY apps/worker ./apps/worker
RUN pnpm --filter @music-ai/worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/.npmrc ./.npmrc
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/worker ./apps/worker
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD pgrep -f "node apps/worker" || exit 1
CMD ["node", "apps/worker/dist/index.js"]
