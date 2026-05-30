# Build and serve the nuxt-spyglass docs site (a pnpm workspace member).
# The Docker build context is the REPO ROOT so the workspace lockfile resolves
# (build with: docker build -f docs/Dockerfile .).

# ── Build ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY . .
# Install only the docs workspace (and its deps), validated against the lockfile.
RUN pnpm install --frozen-lockfile --filter docs...
RUN pnpm --filter docs build

# ── Runtime ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/docs/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
