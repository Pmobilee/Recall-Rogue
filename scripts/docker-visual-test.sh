#!/bin/bash
# Docker Visual Test — Agent-callable launcher
#
# Two modes:
#   COLD (default): Spins up a new container per test. ~54s. Simple, fully isolated.
#   WARM (--warm):  Boots once, reuses for multiple tests. ~14s per test after first.
#
# Usage:
#   # Cold mode (one-shot)
#   scripts/docker-visual-test.sh --scenario combat-basic --agent-id agent-1
#
#   # Warm mode (persistent container)
#   scripts/docker-visual-test.sh --warm start --agent-id agent-1     # Boot (40s, once)
#   scripts/docker-visual-test.sh --warm test  --agent-id agent-1 --scenario combat-boss  # ~14s
#   scripts/docker-visual-test.sh --warm test  --agent-id agent-1 --scenario shop          # ~14s
#   scripts/docker-visual-test.sh --warm stop  --agent-id agent-1     # Shutdown
#   scripts/docker-visual-test.sh --warm status --agent-id agent-1    # Health check
#
# Options:
#   --scenario <preset>    Scenario preset (default: combat-basic)
#   --output <dir>         Output directory (default: /tmp/rr-docker-visual/<timestamp>)
#   --wait <ms>            Wait after scenario load (default: 2000)
#   --agent-id <id>        Agent identifier (default: docker-<pid>)
#   --eval <js>            Custom JS to evaluate after scenario load
#   --no-build             Skip Docker image rebuild check
#   --warm <cmd>           Warm mode: start|test|stop|status
#
# Output files in <output-dir>/:
#   screenshot.png         Playwright full-page screenshot
#   rr-screenshot.jpg      __rrScreenshot() composited capture
#   layout-dump.txt        __rrLayoutDump() text output
#   result.json            Structured test result

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker/playwright-xvfb"
IMAGE_NAME="rr-playwright"

# Defaults
SCENARIO="combat-basic"
WAIT_MS="2000"
AGENT_ID="docker-$$"
CUSTOM_EVAL=""
NO_BUILD=false
OUTPUT_DIR=""
WARM_CMD=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --scenario)   SCENARIO="$2"; shift 2 ;;
        --output)     OUTPUT_DIR="$2"; shift 2 ;;
        --wait)       WAIT_MS="$2"; shift 2 ;;
        --agent-id)   AGENT_ID="$2"; shift 2 ;;
        --eval)       CUSTOM_EVAL="$2"; shift 2 ;;
        --no-build)   NO_BUILD=true; shift ;;
        --warm)       WARM_CMD="$2"; shift 2 ;;
        *)            echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Container name for warm mode (deterministic per agent)
CONTAINER_NAME="rr-warm-${AGENT_ID}"
WARM_PORT_BASE=3200

# Check Docker is running
if ! docker info &>/dev/null; then
    echo "ERROR: Docker is not running. Start Docker Desktop first."
    exit 1
fi

# Ensure image exists
ensure_image() {
    if [ "$NO_BUILD" = false ]; then
        if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
            echo "Building $IMAGE_NAME image..."
            docker build -t "$IMAGE_NAME" "$DOCKER_DIR" 2>&1 | tail -5
        fi
    fi
}

# ─── WARM MODE ────────────────────────────────────────────────

find_warm_port() {
    # Each agent gets a deterministic port based on agent-id hash
    local hash=$(echo -n "$AGENT_ID" | cksum | awk '{print $1}')
    echo $(( 3200 + (hash % 100) ))
}

if [ -n "$WARM_CMD" ]; then
    WARM_PORT=$(find_warm_port)

    case "$WARM_CMD" in
        start)
            ensure_image

            # Check if already running
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                echo "Warm container '$CONTAINER_NAME' already running on port $WARM_PORT"
                curl -s "http://localhost:${WARM_PORT}/health" 2>/dev/null || echo "(not yet ready)"
                exit 0
            fi

            echo "Starting warm container: $CONTAINER_NAME (port $WARM_PORT)"
            docker run -d --rm \
                --name "$CONTAINER_NAME" \
                --add-host=host.docker.internal:host-gateway \
                --shm-size=2g \
                -p "${WARM_PORT}:3200" \
                -v "/tmp/rr-docker-visual:/tmp/rr-test-output" \
                -e DEV_SERVER=http://host.docker.internal:5173 \
                -e AGENT_ID="$AGENT_ID" \
                "$IMAGE_NAME" \
                node /app/warm-server.mjs

            # Wait for health
            echo -n "Booting"
            for i in $(seq 1 120); do
                if curl -s "http://localhost:${WARM_PORT}/health" 2>/dev/null | grep -q '"ready":true'; then
                    echo ""
                    echo "✓ Warm container ready on port $WARM_PORT"
                    curl -s "http://localhost:${WARM_PORT}/health" | python3 -m json.tool 2>/dev/null || true
                    exit 0
                fi
                echo -n "."
                sleep 1
            done
            echo ""
            echo "ERROR: Container failed to become ready in 120s"
            docker logs "$CONTAINER_NAME" 2>&1 | tail -20
            exit 1
            ;;

        test)
            # Check container is running
            if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                echo "ERROR: No warm container '$CONTAINER_NAME'. Run: $0 --warm start --agent-id $AGENT_ID"
                exit 1
            fi

            echo "Warm test: scenario=$SCENARIO agent=$AGENT_ID port=$WARM_PORT"
            RESULT=$(curl -s -X POST "http://localhost:${WARM_PORT}/test" \
                -H 'Content-Type: application/json' \
                -d "{\"scenario\":\"${SCENARIO}\",\"wait\":${WAIT_MS},\"evalJs\":\"${CUSTOM_EVAL}\"}")

            # Extract test dir from result
            TEST_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('testId','unknown'))" 2>/dev/null || echo "unknown")
            DURATION=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('durationMs',0))" 2>/dev/null || echo "?")
            SUCCESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")

            TEST_DIR="/tmp/rr-docker-visual/${TEST_ID}"

            echo ""
            echo "Result: ${SUCCESS} in ${DURATION}ms"
            echo "Output: $TEST_DIR/"
            ls -la "$TEST_DIR/" 2>/dev/null || echo "(files in container volume)"
            echo ""
            echo "Screenshot:    $TEST_DIR/screenshot.png"
            echo "RR Screenshot: $TEST_DIR/rr-screenshot.jpg"
            echo "Layout Dump:   $TEST_DIR/layout-dump.txt"

            if [ "$SUCCESS" = "False" ]; then
                echo "$RESULT" | python3 -m json.tool 2>/dev/null
                exit 1
            fi
            ;;

        stop)
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                echo "Stopping warm container: $CONTAINER_NAME"
                curl -s -X POST "http://localhost:${WARM_PORT}/stop" 2>/dev/null || true
                sleep 1
                docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
                echo "✓ Stopped"
            else
                echo "No warm container '$CONTAINER_NAME' running"
            fi
            ;;

        status)
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                curl -s "http://localhost:${WARM_PORT}/health" | python3 -m json.tool 2>/dev/null
            else
                echo "No warm container '$CONTAINER_NAME' running"
                exit 1
            fi
            ;;

        *)
            echo "Unknown warm command: $WARM_CMD (use: start|test|stop|status)"
            exit 1
            ;;
    esac
    exit 0
fi

# ─── COLD MODE (original one-shot behavior) ──────────────────

ensure_image

# Default output dir
if [ -z "$OUTPUT_DIR" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    OUTPUT_DIR="/tmp/rr-docker-visual/${AGENT_ID}_${SCENARIO}_${TIMESTAMP}"
fi
mkdir -p "$OUTPUT_DIR"

# Check dev server
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
    echo "WARNING: Dev server may not be running at localhost:5173"
fi

echo "Docker Visual Test (cold): scenario=$SCENARIO agent=$AGENT_ID"
echo "Output: $OUTPUT_DIR"

# Run container
docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    --shm-size=2g \
    -v "$OUTPUT_DIR:/tmp/rr-test-output" \
    -e DEV_SERVER=http://host.docker.internal:5173 \
    -e SCENARIO="$SCENARIO" \
    -e VIEWPORT_W="${VIEWPORT%x*}" \
    -e VIEWPORT_H="${VIEWPORT#*x}" \
    -e WAIT_MS="$WAIT_MS" \
    -e AGENT_ID="$AGENT_ID" \
    -e CUSTOM_EVAL="$CUSTOM_EVAL" \
    "$IMAGE_NAME" \
    node /app/visual-test-runner.mjs

EXIT_CODE=$?

echo ""
echo "Output files:"
ls -la "$OUTPUT_DIR/" 2>/dev/null
echo ""
echo "Screenshot: $OUTPUT_DIR/screenshot.png"
echo "RR Screenshot: $OUTPUT_DIR/rr-screenshot.jpg"
echo "Layout Dump: $OUTPUT_DIR/layout-dump.txt"
echo "Result JSON: $OUTPUT_DIR/result.json"

exit $EXIT_CODE
