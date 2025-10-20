FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY ../../pnpm-workspace.yaml ./
COPY ../../package.json ./
COPY ../../pnpm-lock.yaml ./
RUN pnpm fetch
COPY ../../ ./
RUN pnpm -w install --frozen-lockfile

FROM deps AS runner
WORKDIR /app
ENV NODE_ENV=production
CMD ["node", "services/worker/dist/index.js"]
