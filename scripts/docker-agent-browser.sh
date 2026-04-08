#!/bin/bash
# Launch an isolated browser container for agent visual testing.
#
# Each invocation starts a new Docker container with:
#   - Its own Xvfb display (no screen, no lock needed)
#   - Chromium with WebGL via SwiftShader
#   - Full Phaser/Canvas/Shader support
#   - Network access to host's dev server (localhost:5173)
#
# Usage:
#   scripts/docker-agent-browser.sh                    # Run WebGL verification test
#   scripts/docker-agent-browser.sh test               # Same as above
#   scripts/docker-agent-browser.sh shell              # Interactive shell inside container
#   scripts/docker-agent-browser.sh run <script.mjs>   # Run a custom script
#   scripts/docker-agent-browser.sh screenshot <url>    # Take a screenshot of a URL
#
# Screenshots are saved to /tmp/rr-docker-screenshots/ on the host.
#
# Requirements:
#   - Docker Desktop running
#   - Dev server running (npm run dev)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker/playwright-xvfb"
IMAGE_NAME="rr-playwright"
OUTPUT_HOST="/tmp/rr-docker-screenshots"
CONTAINER_OUTPUT="/tmp/rr-test-output"

# Ensure output directory exists on host
mkdir -p "$OUTPUT_HOST"

# Build image if needed (check if image exists)
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building $IMAGE_NAME image..."
    docker build -t "$IMAGE_NAME" "$DOCKER_DIR"
fi

case "${1:-test}" in
    test)
        echo "Running WebGL verification test..."
        docker run --rm \
            --add-host=host.docker.internal:host-gateway \
            --shm-size=2g \
            -v "$OUTPUT_HOST:$CONTAINER_OUTPUT" \
            -e DEV_SERVER=http://host.docker.internal:5173 \
            "$IMAGE_NAME"
        echo ""
        echo "Screenshots saved to: $OUTPUT_HOST/"
        ls -la "$OUTPUT_HOST/" 2>/dev/null || true
        ;;

    shell)
        echo "Starting interactive shell in container..."
        docker run --rm -it \
            --add-host=host.docker.internal:host-gateway \
            --shm-size=2g \
            -v "$OUTPUT_HOST:$CONTAINER_OUTPUT" \
            -e DEV_SERVER=http://host.docker.internal:5173 \
            "$IMAGE_NAME" \
            /bin/bash
        ;;

    run)
        if [ -z "$2" ]; then
            echo "Usage: $0 run <script.mjs>"
            exit 1
        fi
        SCRIPT_PATH="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
        echo "Running custom script: $SCRIPT_PATH"
        docker run --rm \
            --add-host=host.docker.internal:host-gateway \
            --shm-size=2g \
            -v "$OUTPUT_HOST:$CONTAINER_OUTPUT" \
            -v "$SCRIPT_PATH:/app/custom-script.mjs:ro" \
            -e DEV_SERVER=http://host.docker.internal:5173 \
            "$IMAGE_NAME" \
            node /app/custom-script.mjs
        ;;

    screenshot)
        URL="${2:-http://host.docker.internal:5173?skipOnboarding=true&devpreset=post_tutorial}"
        echo "Taking screenshot of: $URL"
        docker run --rm \
            --add-host=host.docker.internal:host-gateway \
            --shm-size=2g \
            -v "$OUTPUT_HOST:$CONTAINER_OUTPUT" \
            -e DEV_SERVER=http://host.docker.internal:5173 \
            -e SCREENSHOT_URL="$URL" \
            "$IMAGE_NAME" \
            node -e "
              import('playwright').then(async ({chromium}) => {
                const browser = await chromium.launch({
                  executablePath: '/usr/bin/chromium',
                  headless: false,
                  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
                         '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
                         '--ignore-gpu-blocklist','--window-size=1920,1080'],
                });
                const page = await (await browser.newContext({viewport:{width:1920,height:1080}})).newPage();
                await page.goto(process.env.SCREENSHOT_URL, {waitUntil:'domcontentloaded',timeout:30000});
                await page.waitForTimeout(5000);
                const fs = await import('fs');
                fs.mkdirSync('$CONTAINER_OUTPUT', {recursive:true});
                await page.screenshot({path:'$CONTAINER_OUTPUT/screenshot.png'});
                console.log('Screenshot saved');
                await browser.close();
              });
            "
        echo "Screenshot saved to: $OUTPUT_HOST/screenshot.png"
        ;;

    build)
        echo "Building $IMAGE_NAME image..."
        docker build -t "$IMAGE_NAME" "$DOCKER_DIR"
        echo "Done."
        ;;

    *)
        echo "Usage: $0 {test|shell|run|screenshot|build}"
        exit 1
        ;;
esac
