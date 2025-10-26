# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# enable pnpm via corepack
RUN corepack enable

# 1. copy workspace manifests first (better cache)
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./package.json
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY shared/package.json ./shared/package.json
COPY packages/ledger/package.json ./packages/ledger/package.json

# 2. install deps for the whole workspace
RUN pnpm install --frozen-lockfile

# 3. copy full repo source
COPY . .

# 4. build JUST the api-gateway package (this runs tsc and writes dist/)
RUN pnpm --filter @apgms/api-gateway build


# ---------- runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# copy the entire built workspace forward so pnpm symlinks + shared code all work
COPY --from=build /app /app

EXPOSE 3000

# run the compiled server with Node's extension fallback for bare imports ("./lib/pii" -> "./lib/pii.js")
CMD ["node", "--experimental-specifier-resolution=node", "services/api-gateway/dist/services/api-gateway/src/server.js"]
