# syntax=docker/dockerfile:1.7
FROM node:20.18-alpine AS base
WORKDIR /usr/src/app

FROM base AS deps
COPY ../../pnpm-workspace.yaml ../../package.json ../../pnpm-lock.yaml /usr/src/
COPY ../../packages /usr/src/packages
COPY ../../shared /usr/src/shared
COPY package.json tsconfig.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate && \
    pnpm install --frozen-lockfile --filter @apgms/ml-inference...

FROM deps AS build
COPY src ./src
COPY model ./model
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /srv/app
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/model ./model
COPY package.json ./

CMD ["node", "dist/index.js"]
