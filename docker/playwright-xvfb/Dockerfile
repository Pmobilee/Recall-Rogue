# Recall Rogue — Parallel Agent Browser Container
# Provides Chrome + Xvfb + Playwright for isolated visual testing.
# Each container gets its own virtual display — no screen, no locks, full WebGL via SwiftShader.
#
# Build:  docker build -t rr-playwright docker/playwright-xvfb/
# Run:    docker run --rm --add-host=host.docker.internal:host-gateway rr-playwright
#
# Architecture: ARM64-native on Apple Silicon. Uses Chromium from apt (has ARM64 builds).

FROM node:22-bookworm-slim

# System deps for Chromium + Xvfb
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Xvfb (virtual framebuffer)
    xvfb \
    # Chromium browser (ARM64-native from Debian repos)
    chromium \
    # Fonts — needed for text rendering in screenshots
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    # Chromium shared library deps
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    # Utilities
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tell Playwright to skip downloading browsers — we use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Point Playwright at system Chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Install only Playwright (not the full project deps)
RUN npm init -y && npm install playwright@latest

# Copy test scripts
COPY test-webgl.mjs /app/test-webgl.mjs
COPY visual-test-runner.mjs /app/visual-test-runner.mjs
COPY warm-server.mjs /app/warm-server.mjs
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Warm server port
EXPOSE 3200

# Xvfb display
ENV DISPLAY=:99

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "/app/test-webgl.mjs"]
