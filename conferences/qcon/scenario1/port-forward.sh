#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Setting up port forwarding for all services...${NC}"
echo ""

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping port-forwards...${NC}"
    jobs -p | xargs -r kill 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for pods to be ready
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=trades --timeout=60s
kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=60s
kubectl wait --for=condition=ready pod -l app=trades-a2a-server --timeout=60s

echo ""
echo -e "${GREEN}✓ All pods are ready${NC}"
echo ""

# Start port-forwarding in background
echo -e "${YELLOW}Starting port-forwards:${NC}"

echo -e "  • MCP Server:     http://localhost:8080"
kubectl port-forward service/trades-mcp-server 8080:80 > /dev/null 2>&1 &

echo -e "  • Trades API:     http://localhost:8081"
kubectl port-forward service/trades 8081:80 > /dev/null 2>&1 &

echo -e "  • A2A Server:     http://localhost:9103"
kubectl port-forward service/trades-a2a-server 9103:80 > /dev/null 2>&1 &

echo ""
echo -e "${GREEN}✓ Port-forwarding active${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop port-forwarding${NC}"
echo ""

# Keep script running
wait
