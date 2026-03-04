# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────────
FROM node:22-slim AS runtime
RUN groupadd -r terra && useradd -r -g terra terra
WORKDIR /app

# Copy built assets
COPY --from=build /app/dist ./dist

# Copy server if it exists
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || true

# Security: run as non-root
USER terra

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
