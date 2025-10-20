FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY ../../pnpm-workspace.yaml ./
COPY ../../package.json ./
COPY ../../pnpm-lock.yaml ./
RUN pnpm fetch
COPY ../../ ./
RUN pnpm -w install --frozen-lockfile

FROM deps AS build
WORKDIR /app/apps/webapp
RUN pnpm build || true

FROM node:20-alpine AS runner
WORKDIR /app/apps/webapp
ENV NODE_ENV=development
COPY --from=deps /app .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
