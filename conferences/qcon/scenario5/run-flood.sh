#!/bin/bash

# Flood the portfolio with trades to create an imbalance
# Prerequisites: Port-forward must be running (./port-forward-a2a.sh)

IMAGE="jpgough/rebalancer-agent:latest"
A2A_URL="http://host.docker.internal:9103"

# Arguments with defaults
INSTRUMENT="${1:-NVDA}"
COUNT="${2:-20}"
QTY="${3:-5000}"

TOTAL=$((COUNT * QTY))

echo "💥 Flooding portfolio with trades..."
echo ""
echo "📈 Instrument: $INSTRUMENT"
echo "📊 Trades: $COUNT x $QTY shares = ${TOTAL} total shares"
echo ""
echo "⚠️  This will create a portfolio imbalance"
echo "🤖 The rebalancer agent should detect and correct this"
echo ""

sleep 1

docker run --rm \
  -e A2A_URL=$A2A_URL \
  $IMAGE flood $INSTRUMENT $COUNT $QTY

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Flood complete!"
    echo ""
    echo "💡 Watch the rebalancer agent terminal to see it detect and correct the imbalance"
    echo ""
else
    echo ""
    echo "❌ Flood failed"
    exit 1
fi
