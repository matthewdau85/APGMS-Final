# Dockerfile – monorepo build for @apgms/api-gateway

FROM node:20 AS build

WORKDIR /app

# Environment for production + Prisma engines
ENV NODE_ENV=production \
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

RUN corepack enable

# 1. Copy manifests for efficient pnpm install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

COPY shared/package.json ./shared/package.json
COPY packages/domain-policy/package.json ./packages/domain-policy/package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/connectors/package.json ./services/connectors/package.json

# Install all workspace deps (prod + needed peer deps)
RUN pnpm install --frozen-lockfile

# 2. Copy full source
COPY . .

# 3. Build only the backend packages needed in this image
RUN pnpm --filter @apgms/shared build \
  && pnpm --filter @apgms/domain-policy build \
  && pnpm --filter @apgms/api-gateway build

# 4. Runtime image
FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

# Bring in node_modules + workspace metadata
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Bring in built code
COPY --from=build /app/services/api-gateway ./services/api-gateway
COPY --from=build /app/shared ./shared
COPY --from=build /app/packages ./packages

EXPOSE 3000

CMD ["pnpm", "--filter", "@apgms/api-gateway", "start"]
