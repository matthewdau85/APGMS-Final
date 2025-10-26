# ---------- deps/build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# enable pnpm
RUN corepack enable

# copy the whole mono-repo in so pnpm can resolve workspaces
COPY . .

# install all workspace deps (includes webapp, shared, ledger, etc.)
RUN pnpm install --frozen-lockfile

# optional: run a typecheck/build so we fail early instead of at runtime
# this will run whatever "build" script webapp has; it's okay if it's a no-op
WORKDIR /app/apps/webapp
RUN pnpm build || true

# ---------- runtime (dev) stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=development

# bring in node_modules and source code
COPY --from=build /app /app

# expose Vite dev port from inside the container
EXPOSE 5173

# run the dev server bound to all interfaces
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
