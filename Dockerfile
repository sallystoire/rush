FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/api-spec/package.json             lib/api-spec/
COPY lib/api-client-react/package.json     lib/api-client-react/
COPY lib/api-zod/package.json             lib/api-zod/
COPY lib/db/package.json                  lib/db/
COPY artifacts/paname-rush/package.json   artifacts/paname-rush/
COPY artifacts/api-server/package.json    artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
# Both glibc and musl rollup binaries are in the lockfile so Vite builds
# successfully on any Railway runner regardless of libc detection.
RUN pnpm install --frozen-lockfile

# ── Build ──────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ARG VITE_DISCORD_CLIENT_ID
ENV BASE_PATH=/ \
    NODE_ENV=production \
    VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
RUN pnpm run build:railway

# ── Production image (minimal — only compiled output, no node_modules) ─
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/artifacts/api-server/dist        ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/paname-rush/dist/public ./artifacts/paname-rush/dist/public

EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
