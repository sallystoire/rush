FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY lib/api-spec/package.json           lib/api-spec/
COPY lib/api-client-react/package.json   lib/api-client-react/
COPY lib/api-zod/package.json            lib/api-zod/
COPY lib/db/package.json                 lib/db/
COPY artifacts/paname-rush/package.json  artifacts/paname-rush/
COPY artifacts/api-server/package.json   artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
# Support both glibc and musl so Vite/Rollup native binaries work on any
# build runner (Railway may report musl even on Debian-based images)
RUN printf '\nsupportedArchitectures[libc][]=glibc\nsupportedArchitectures[libc][]=musl\n' >> .npmrc && \
    pnpm install

# ── Build ─────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ARG VITE_DISCORD_CLIENT_ID
ENV BASE_PATH=/ \
    NODE_ENV=production \
    VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
RUN pnpm run build:railway

# ── Production image ──────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests (needed for pnpm CLI + drizzle migrations)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/api-spec/package.json           lib/api-spec/
COPY lib/api-client-react/package.json   lib/api-client-react/
COPY lib/api-zod/package.json            lib/api-zod/
COPY lib/db/package.json                 lib/db/
COPY artifacts/api-server/package.json   artifacts/api-server/
COPY artifacts/paname-rush/package.json  artifacts/paname-rush/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/

# Copy lib sources (needed for drizzle config at runtime)
COPY lib/db/                             lib/db/
COPY lib/api-zod/                        lib/api-zod/
COPY lib/api-spec/                       lib/api-spec/

# Reuse node_modules from deps — no second download
COPY --from=deps /app/node_modules                              ./node_modules
COPY --from=deps /app/lib/db/node_modules                       ./lib/db/node_modules
COPY --from=deps /app/lib/api-zod/node_modules                  ./lib/api-zod/node_modules
COPY --from=deps /app/artifacts/api-server/node_modules         ./artifacts/api-server/node_modules

# Server bundle (esbuild — self-contained)
COPY --from=builder /app/artifacts/api-server/dist              ./artifacts/api-server/dist
# Frontend static files served by Express
COPY --from=builder /app/artifacts/paname-rush/dist/public      ./artifacts/paname-rush/dist/public

EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
