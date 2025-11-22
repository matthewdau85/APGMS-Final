FROM node:20

WORKDIR /app
ENV NODE_ENV=production

# Enable pnpm via corepack
RUN corepack enable

# Copy the entire repo into the image; .dockerignore will exclude node_modules, dist, etc.
COPY . .

# Install workspace dependencies (same as local)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client in the context of the api-gateway package,
# so it uses the same schema/config as on your machine.
RUN pnpm --filter @apgms/api-gateway exec prisma generate

# Build the bits the gateway depends on.
# (domain-policy is a pure TS lib; connectors can be added later once its build is clean.)
RUN pnpm --filter @apgms/shared build \
  && pnpm --filter @apgms/domain-policy build \
  && pnpm --filter @apgms/api-gateway build

# Run the compiled gateway
WORKDIR /app/services/api-gateway
CMD ["node", "dist/index.js"]
