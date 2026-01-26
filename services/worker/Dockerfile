FROM node:20.19.6-bookworm-slim

ARG GIT_SHA=dev
ARG BUILD_TS=dev

ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TS=${BUILD_TS}

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm config set network-concurrency 1 \
 && pnpm config set fetch-retries 5 \
 && pnpm config set fetch-retry-mintimeout 20000 \
 && pnpm config set fetch-retry-maxtimeout 120000

RUN pnpm install --frozen-lockfile

WORKDIR /repo/services/worker

# If worker is TSX-dev style, keep it as-is.
# If you have a build/dist entrypoint, swap CMD accordingly.
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
