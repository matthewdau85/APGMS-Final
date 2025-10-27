# Dev-mode Dockerfile for the admin webapp
# Runs Vite dev server on port 5173

FROM node:20-alpine

WORKDIR /app

# enable pnpm in the container
RUN corepack enable

# copy the app sources into the container
# IMPORTANT: we now include index.html
COPY package.json ./
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts
COPY index.html ./index.html
COPY src ./src

# install deps for this app
RUN pnpm install

# expose Vite dev port
EXPOSE 5173

# run Vite dev server and bind it so Docker can forward
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--strictPort", "--port", "5173"]
