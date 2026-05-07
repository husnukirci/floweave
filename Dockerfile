# floweave Dockerfile — multi-stage. Stage 1 builds the Web Component
# bundle and prunes dev dependencies; stage 2 is a slim runtime image
# that runs the Hono proxy and serves the static demo + bundle from the
# same origin (sidesteps CORS, lets the chat panel reach the proxy at
# /api/chat from demo.html).

# --- Stage 1: build ---------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (cached unless package-lock.json changes).
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the WC bundle. The dev SPA
# build is not needed in the runtime image — demo.html loads
# dist-wc/workflow-editor.js directly.
COPY . .
RUN npm run build:wc

# Drop dev dependencies so the runtime image only carries what the
# server actually needs (Hono, @hono/node-server, @anthropic-ai/sdk,
# nanoid).
RUN npm prune --omit=dev

# --- Stage 2: runtime -------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy only the artifacts the server needs at runtime.
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/dist-wc ./dist-wc
COPY --from=build /app/demo.html ./demo.html
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3001
# Hono serves dist-wc/ + demo.html from cwd when STATIC_ROOT is set.
ENV STATIC_ROOT=.

EXPOSE 3001

# ANTHROPIC_API_KEY must be supplied at runtime — either via
# `--env-file=.env`, `-e ANTHROPIC_API_KEY=...`, or the docker-compose
# env_file directive. The proxy exits 1 with a structured log if it's
# missing.
CMD ["node", "--env-file-if-exists=.env", "--experimental-strip-types", "--no-warnings", "server/proxy.ts"]
