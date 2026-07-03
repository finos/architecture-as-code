#!/bin/bash

# Run the Rebalancer Agent in a Docker container
# Prerequisites: Port-forward must be running (./port-forward-a2a.sh)

CONTAINER_NAME="rebalancer-agent"
IMAGE="jpgough/rebalancer-agent:latest"
A2A_URL="http://host.docker.internal:9103"
COMMAND="${1:-rebalancer}"

echo "🤖 Starting Rebalancer Agent..."
echo ""

# Check if container already exists
if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
    echo "⚠️  Container '$CONTAINER_NAME' already exists. Removing..."
    docker rm -f $CONTAINER_NAME > /dev/null 2>&1
fi

# Pull image if not cached
if ! docker image inspect $IMAGE > /dev/null 2>&1; then
    echo "📦 Pulling $IMAGE..."
    docker pull $IMAGE
else
    echo "✓ Using cached image: $IMAGE"
fi

# Run in foreground mode
echo "🐳 Starting rebalancer agent..."
echo ""
echo "📊 The agent runs in an OBSERVE → DECIDE → ACT loop every 8 seconds"
echo "🔍 Monitoring portfolio for imbalances..."
echo ""
echo "Press Ctrl+C to stop"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker run --rm \
  --name $CONTAINER_NAME \
  -e A2A_URL=$A2A_URL \
  $IMAGE $COMMAND
