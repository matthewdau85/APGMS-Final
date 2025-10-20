FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY ../../pnpm-workspace.yaml ./
COPY ../../package.json ./
COPY ../../pnpm-lock.yaml ./
RUN pnpm fetch
# bring in package sources for a partial install
COPY ../../ ./
RUN pnpm -w install --frozen-lockfile

FROM deps AS build
WORKDIR /app
RUN pnpm -r build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app .
EXPOSE 3000
CMD ["node", "services/api-gateway/dist/index.js"]
