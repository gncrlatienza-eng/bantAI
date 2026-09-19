# Build from the repository root:
# docker build -f backend/Dockerfile -t bantai-backend:local .
FROM node:24.15.0-bookworm-slim AS build

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/database ./database
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src

RUN npx prisma generate --schema database/prisma/schema.prisma
RUN npm run build

FROM node:24.15.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Prisma's native engine requires OpenSSL on slim Debian images.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/database ./database
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
