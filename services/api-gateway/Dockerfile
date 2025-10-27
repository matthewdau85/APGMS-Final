########################
# Build stage
########################
FROM node:20-alpine AS build

WORKDIR /app
ENV NODE_ENV=production

# enable pnpm via corepack (pnpm is already in your workspace)
RUN corepack enable

# 1. Copy workspace manifests first (cache-friendly)
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY shared/package.json ./shared/package.json
COPY packages/ledger/package.json ./packages/ledger/package.json

# 2. Install all deps for the whole monorepo
RUN pnpm install --frozen-lockfile

# 3. Bring in the full source
COPY . .

# 4. Generate the Prisma client now so TypeScript can see PrismaClient, Org, User, etc.
#    This uses shared/prisma/schema.prisma
RUN pnpm exec prisma generate --schema shared/prisma/schema.prisma

# 5. Build JUST the api-gateway package (this runs `tsc`, outputs dist/)
WORKDIR /app/services/api-gateway
RUN pnpm --filter @apgms/api-gateway build


########################
# Runtime stage
########################
FROM node:20-alpine AS runtime
ENV NODE_ENV=production

RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Copy the entire monorepo state (including node_modules, dist, and generated Prisma client)
COPY --from=build /app /app

# Move to the gateway folder for runtime
WORKDIR /app/services/api-gateway

# Copy start.sh from the repo into the image
COPY services/api-gateway/start.sh ./start.sh

# Fix CRLF from Windows and make executable
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh

EXPOSE 3000

CMD ["./start.sh"]
