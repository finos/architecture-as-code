#!/bin/bash

# Port forward A2A server to localhost
# This must run in a separate terminal

echo "Starting port-forward for A2A server..."
echo "A2A Server will be available at: http://localhost:9103"
echo ""
echo "Agent Card: http://localhost:9103/.well-known/agent.json"
echo ""
echo "Press Ctrl+C to stop port forwarding"
echo ""

kubectl port-forward svc/trades-a2a-server 9103:80
