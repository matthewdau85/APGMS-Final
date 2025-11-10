########################
# Build stage
########################
FROM node:20-alpine AS build

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./package.json
COPY services/ml-service/package.json ./services/ml-service/package.json

RUN pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/services/ml-service
RUN pnpm --filter @apgms/ml-service build

########################
# Runtime stage
########################
FROM node:20-alpine AS runtime
ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app /app

WORKDIR /app/services/ml-service

EXPOSE 9100

CMD ["node", "dist/index.js"]
