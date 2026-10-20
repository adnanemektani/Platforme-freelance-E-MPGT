# syntax=docker/dockerfile:1.7
# Image unique, deux cibles : `api` (NestJS + migrations Prisma) et `web` (Next.js autonome).
#
#   docker build -f docker/Dockerfile --target api -t empgt-freelance-api .
#   docker build -f docker/Dockerfile --target web -t empgt-freelance-web .

FROM node:24.20.0-trixie-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /repo

# ── Dépendances et compilation ───────────────────────────────────────────────
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
# Le contrôle de chaîne d'approvisionnement de pnpm 11 (délai minimal de publication) télécharge les
# métadonnées complètes de chaque paquet : elles sont mises en cache entre deux constructions, et les
# délais réseau sont allongés pour les connexions lentes.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=cache,id=pnpm-metadata,target=/root/.cache/pnpm \
    pnpm install --frozen-lockfile --fetch-timeout=300000 --fetch-retries=5
COPY . .
# URL factice : `prisma generate` lit la configuration mais ne se connecte pas.
ARG API_INTERNAL_URL=http://api:4000
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    API_INTERNAL_URL=${API_INTERNAL_URL}
RUN pnpm --filter @empgt/contracts build \
 && pnpm --filter @empgt/api build \
 && pnpm --filter @empgt/web build

# ── API ──────────────────────────────────────────────────────────────────────
FROM base AS api
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/
COPY --from=build /repo/packages/contracts/package.json /repo/packages/contracts/package.json
COPY --from=build /repo/packages/contracts/dist /repo/packages/contracts/dist
COPY --from=build /repo/packages/contracts/node_modules /repo/packages/contracts/node_modules
COPY --from=build /repo/apps/api/package.json /repo/apps/api/prisma.config.ts /repo/apps/api/
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/prisma /repo/apps/api/prisma
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ── Frontend ─────────────────────────────────────────────────────────────────
FROM node:24.20.0-trixie-slim AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
