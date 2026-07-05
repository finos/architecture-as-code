#!/bin/bash

# Run the QCON Agent UI in a Docker container
# Prerequisites: Port-forward must be running (./port-forward-a2a.sh)

CONTAINER_NAME="qcon-agent-ui"
IMAGE="jpgough/qcon-agent-ui:latest"
PORT="3000"
A2A_URL="http://host.docker.internal:9103"

echo "🚀 Starting QCON Agent UI..."
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

# Run the container
echo "🐳 Starting container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p $PORT:80 \
  -e A2A_URL=$A2A_URL \
  $IMAGE

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ QCON Agent UI started successfully!"
    echo ""
    echo "📍 Access the UI at: http://localhost:$PORT"
    echo ""
    echo "💡 Usage:"
    echo "   1. Open http://localhost:$PORT in your browser"
    echo "   2. Click 'Connect' to connect to the A2A server"
    echo "   3. Explore available tools and portfolio status"
    echo ""
    echo "📋 View logs:"
    echo "   docker logs -f $CONTAINER_NAME"
    echo ""
    echo "🛑 Stop the UI:"
    echo "   docker rm -f $CONTAINER_NAME"
    echo ""
else
    echo "❌ Failed to start QCON Agent UI"
    exit 1
fi
