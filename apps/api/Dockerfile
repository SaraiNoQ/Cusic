FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache wget \
  && npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@9.15.0

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY apps/api ./apps/api
RUN rm -rf apps/api/dist && pnpm --filter @music-ai/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/.npmrc ./.npmrc
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/system/health || exit 1
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
