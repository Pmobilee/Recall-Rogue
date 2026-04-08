#!/bin/bash
# Start Xvfb virtual display, then run the provided command.
# Xvfb provides a real X11 display server without any physical screen.
# Chrome thinks it has a monitor — WebGL, Canvas, Phaser all work.

set -e

# Start Xvfb in the background
# - :99 = display number
# - 1920x1080x24 = resolution + 24-bit color depth (matches Steam PC target)
# - -ac = disable access control (allow any client)
# - +extension GLX = enable GLX extension for OpenGL/WebGL
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
XVFB_PID=$!

# Wait for Xvfb to be ready
sleep 1

# Verify Xvfb is running
if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi

echo "Xvfb running on display :99 (1920x1080x24)"

# Run the actual command
exec "$@"
