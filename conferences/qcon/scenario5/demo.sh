#!/bin/bash

export BAT_THEME="zenburn"

# Check if verbose mode is set (from parent script)
VERBOSE_MODE=${VERBOSE_MODE:-"true"}

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

heading() {
    local text=$1
    echo -e "${YELLOW_BOLD}${text}${NC}\n"
}

info() {
    local text=$1
    echo -e "${YELLOW}${text}${NC}\n"
}

success() {
    local text=$1
    echo -e "${GREEN}${text}${NC}\n"
}

error_msg() {
    local text=$1
    echo -e "${RED}${text}\033[0m\n"
}

run_command() {
    local text=$1
    echo -e "${GREEN}> ${text}${NC}"
}

stage() {
    local text=$1
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ${text}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Ensure we're in the scenario5 directory
cd "$(dirname "$0")"

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}📖 Mode: Story (commands + explanations)${NC}"
else
    echo -e "${CYAN}⚡ Mode: Concise (commands only)${NC}"
fi
echo ""

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}🤖 The Vision:${NC}"
    echo "   Agents aren't just consuming APIs anymore — they're coordinating with each other."
    echo "   Agent-to-Agent (A2A) protocol enables autonomous agents to discover and invoke"
    echo "   skills, making decisions without human intervention."
    echo ""
    echo -e "${CYAN}📈 The Demo:${NC}"
    echo "   1. Deploy A2A server that exposes portfolio management skills"
    echo "   2. QCON UI Agent — Human-facing interface to explore skills"
    echo "   3. Rebalancer Agent — Autonomous agent running OBSERVE → DECIDE → ACT loop"
    echo "   4. Flood portfolio with trades → Watch rebalancer correct imbalances"
    echo ""
fi
clear
# ============================================================================
# Step 1: Verify Cluster
# ============================================================================

clear
stage "Step 1 — Verify Minikube Cluster"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Checking if minikube is running..."
    info "Why: We need an active cluster to deploy the A2A server"
fi

if minikube status > /dev/null 2>&1; then
    success "✓ Minikube cluster is running"
else
    error_msg "❌ Minikube is not running"
    echo "Start minikube with: minikube start"
    exit 1
fi
echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# Step 2: Pull and Load Docker Images
# ============================================================================

clear
heading "Starting Scenario 5: Rapid Platform Adoption"
echo ""
echo "Press Enter to begin..."
read

clear
stage "Step 2 — Load Docker Images"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Checking and loading Docker images into minikube..."
    info "Why: The deployments use imagePullPolicy: Never, so images must be preloaded"
    
    # Check and pull trades-rest-server if needed
    if ! docker image inspect jpgough/trades-rest-server:latest > /dev/null 2>&1; then
        echo "📦 Pulling jpgough/trades-rest-server:latest..."
        docker pull jpgough/trades-rest-server:latest > /dev/null 2>&1
    else
        echo "✓ jpgough/trades-rest-server:latest already cached locally"
    fi
    
    # Check and pull trades-a2a-server if needed
    if ! docker image inspect jpgough/trades-a2a-server:latest > /dev/null 2>&1; then
        echo "📦 Pulling jpgough/trades-a2a-server:latest..."
        docker pull jpgough/trades-a2a-server:latest > /dev/null 2>&1
    else
        echo "✓ jpgough/trades-a2a-server:latest already cached locally"
    fi
    
    echo ""
    echo "Loading images into minikube..."
    minikube image load jpgough/trades-rest-server:latest > /dev/null 2>&1
    minikube image load jpgough/trades-a2a-server:latest > /dev/null 2>&1
    success "✓ Images loaded into minikube"
else
    info "Skipping image loading (only needed in verbose mode)"
fi
echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# Step 3: Deploy to Kubernetes
# ============================================================================

clear
stage "Step 3 — Deploy to Kubernetes"

# Check if pods are already running
TRADES_POD=$(kubectl get pods -l app=trades -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
A2A_POD=$(kubectl get pods -l app=trades-a2a-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -n "$TRADES_POD" ] && [ -n "$A2A_POD" ]; then
    TRADES_STATUS=$(kubectl get pod "$TRADES_POD" -o jsonpath='{.status.phase}' 2>/dev/null)
    A2A_STATUS=$(kubectl get pod "$A2A_POD" -o jsonpath='{.status.phase}' 2>/dev/null)
    
    if [ "$TRADES_STATUS" == "Running" ] && [ "$A2A_STATUS" == "Running" ]; then
        success "✓ Pods already running - skipping deployment"
        if [ "$VERBOSE_MODE" == "true" ]; then
            info "Found running pods:"
            echo "  • Trades API: $TRADES_POD ($TRADES_STATUS)"
            echo "  • A2A Server: $A2A_POD ($A2A_STATUS)"
            echo ""
        fi
        kubectl get pods
        echo ""
        echo "Press Enter to continue..."
        read
    else
        if [ "$VERBOSE_MODE" == "true" ]; then
            info "Pods exist but not running - redeploying..."
            info "Trades: $TRADES_STATUS, A2A: $A2A_STATUS"
        fi
        
        run_command "kubectl apply -f trades-deployment.yaml"
        kubectl apply -f trades-deployment.yaml
        echo ""
        
        run_command "kubectl apply -f trades-service.yaml"
        kubectl apply -f trades-service.yaml
        echo ""
        
        run_command "kubectl apply -f a2a-deployment.yaml"
        kubectl apply -f a2a-deployment.yaml
        echo ""
        
        run_command "kubectl apply -f a2a-service.yaml"
        kubectl apply -f a2a-service.yaml
        echo ""
        
        if [ "$VERBOSE_MODE" == "true" ]; then
            info "Waiting for pods to be ready..."
        fi
        
        run_command "kubectl wait --for=condition=ready pod -l app=trades --timeout=90s"
        kubectl wait --for=condition=ready pod -l app=trades --timeout=90s
        run_command "kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=90s"
        kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=90s
        run_command "kubectl wait --for=condition=ready pod -l app=trades-a2a-server --timeout=90s"
        kubectl wait --for=condition=ready pod -l app=trades-a2a-server --timeout=90s
        echo ""
        
        success "✓ Deployment complete"
        echo ""
        run_command "kubectl get pods"
        kubectl get pods
        echo ""
        echo "Press Enter to continue..."
        read
    fi
else
    if [ "$VERBOSE_MODE" == "true" ]; then
        info "Deploying Trades API and A2A Server..."
        info "Why: Creates the backend infrastructure that agents will coordinate through"
    fi
    
    run_command "kubectl apply -f trades-deployment.yaml"
    kubectl apply -f trades-deployment.yaml
    echo ""
    
    run_command "kubectl apply -f trades-service.yaml"
    kubectl apply -f trades-service.yaml
    echo ""
    
    run_command "kubectl apply -f a2a-deployment.yaml"
    kubectl apply -f a2a-deployment.yaml
    echo ""
    
    run_command "kubectl apply -f a2a-service.yaml"
    kubectl apply -f a2a-service.yaml
    echo ""
    
    if [ "$VERBOSE_MODE" == "true" ]; then
        info "Waiting for pods to be ready..."
    fi
    
    run_command "kubectl wait --for=condition=ready pod -l app=trades --timeout=90s"
    kubectl wait --for=condition=ready pod -l app=trades --timeout=90s
    run_command "kubectl wait --for=condition=ready pod -l app=trades-a2a-server --timeout=90s"
    kubectl wait --for=condition=ready pod -l app=trades-a2a-server --timeout=90s
    echo ""
    
    success "✓ Deployment complete"
    echo ""
    run_command "kubectl get pods"
    kubectl get pods
    echo ""
    echo "Press Enter to continue..."
    read
fi

# ============================================================================
# Step 4: Port Forward Instructions
# ============================================================================

clear
stage "Step 4 — Setup Port Forwarding"

info "⚠️  IMPORTANT: Port forwarding required for agent communication"
echo ""
echo -e "${YELLOW_BOLD}In a SEPARATE terminal, run:${NC}"
echo ""
echo -e "${GREEN}  cd $(pwd)${NC}"
echo -e "${GREEN}  ./port-forward-a2a.sh${NC}"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Why: The A2A server runs as ClusterIP, so we need port-forward to access it"
    info "The agents \(UI and Rebalancer\) will connect via http://host.docker.internal:9103"
fi
echo ""
echo "📍 Once port-forward is running, the A2A server will be available at:"
echo "   • http://localhost:9103"
echo "   • Agent Card: http://localhost:9103/.well-known/agent.json"
echo ""
echo -e "${YELLOW_BOLD}Press Enter once port-forward is running...${NC}"
read

# Verify port-forward with 2 attempts
for attempt in 1 2; do
    echo "Verifying port-forward (Attempt $attempt of 2)..."
    if curl -s http://localhost:9103/.well-known/agent.json > /dev/null 2>&1; then
        success "✓ Port-forward confirmed - A2A server is accessible"
        break
    elif [ $attempt -eq 1 ]; then
        echo -e "${RED}✗ Could not reach A2A server at localhost:9103${NC}"
        echo -e "${YELLOW}Please ensure ./port-forward-a2a.sh is running in another terminal${NC}"
        echo ""
        echo "Press Enter to retry verification..."
        read
    else
        error_msg "❌ Could not reach A2A server after 2 attempts"
        info "Please ensure ./port-forward-a2a.sh is running in another terminal"
        exit 1
    fi
done
echo ""

echo "Press Enter to continue..."
read

# ============================================================================
# Step 5: Start QCON UI Agent
# ============================================================================

clear
stage "Step 5 — Start QCON UI Agent"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting the QCON Agent UI..."
    info "Why: Provides a human-facing interface to explore A2A skills"
    info "The UI connects to the A2A server and displays available skills"
fi

echo -e "${YELLOW_BOLD}In a SEPARATE terminal, run:${NC}"
echo ""
echo -e "${GREEN}  cd $(pwd)${NC}"
echo -e "${GREEN}  ./run-agent-ui.sh${NC}"
echo ""
echo "Then open: http://localhost:3000"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "💡 In the UI:"
    echo "   1. Click 'Connect' to connect to the A2A server"
    echo "   2. Explore available skills (get-portfolio, book-trade, rebalance, etc.)"
    echo "   3. Try invoking skills to see agent-to-agent communication in action"
    echo ""
fi
echo -e "${YELLOW_BOLD}Press Enter once you've explored the UI...${NC}"
read

# ============================================================================
# Step 6: Start Rebalancer Agent
# ============================================================================

clear
stage "Step 6 — Start Autonomous Rebalancer Agent"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting the Rebalancer Agent..."
    info "Why: Demonstrates autonomous agent behavior"
    info "The agent runs continuously: OBSERVE → DECIDE → ACT (every 8 seconds)"
fi

echo ""
echo "🤖 Time to start the autonomous rebalancer agent"
echo ""
echo -e "${YELLOW_BOLD}In a SEPARATE terminal, run:${NC}"
echo ""
echo -e "${GREEN}  cd $(pwd)${NC}"
echo -e "${GREEN}  ./run-rebalancer.sh${NC}"
echo ""
echo "📊 You'll see the agent's OBSERVE → DECIDE → ACT loop in real-time"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "💡 Keep this terminal visible — you'll want to watch it during the flood"
fi
echo ""
echo -e "${YELLOW_BOLD}Press Enter once the rebalancer is running...${NC}"
read

# ============================================================================
# Step 7: Flood Portfolio
# ============================================================================

clear
stage "Step 7 — Create Portfolio Imbalance"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Now flood the portfolio to trigger the rebalancer..."
    info "Why: Creates an imbalance that the rebalancer agent will detect and correct"
    info "This simulates a burst of trading activity"
fi

echo ""
echo "💥 Time to create portfolio chaos!"
echo ""
echo "📊 Booking 20 trades of 5,000 NVDA shares each (100k total)"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}Watch the rebalancer terminal for:${NC}"
    echo "   1. Portfolio becomes heavily imbalanced toward NVDA"
    echo "   2. Rebalancer agent detects imbalance in next cycle (within 8 sec)"
    echo "   3. Agent autonomously decides to rebalance"
    echo "   4. Agent executes offsetting trades without human approval"
    echo ""
fi
echo ""
echo "Press Enter to flood the portfolio..."
read

./run-flood.sh NVDA 20 5000

if [ $? -eq 0 ]; then
    echo ""
    success "✓ Portfolio flooded!"
    echo ""
    if [ "$VERBOSE_MODE" == "true" ]; then
        info "🎯 The Key Insight:"
        echo "   The rebalancer agent doesn't need human approval or coordination."
        echo "   It discovers skills via A2A, analyzes the portfolio, and acts autonomously."
        echo "   This is the future of API consumption — agents as first-class citizens."
        echo ""
        info "💡 Check the rebalancer terminal to see it correcting the imbalance!"
    else
        info "Watch the rebalancer terminal — it's correcting the imbalance now!"
    fi
else
    error_msg "❌ Flood failed"
    exit 1
fi

echo ""
echo -e "${YELLOW_BOLD}Once you've observed the rebalancer for a while, press Enter to continue...${NC}"
read

# ============================================================================
# Summary
# ============================================================================


if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}What We Demonstrated:${NC}"
    echo "   1. A2A Protocol — Agents discover skills via agent card"
    echo "   2. UI Agent — Human-facing skill exploration"
    echo "   3. Autonomous Agent — Rebalancer runs without human oversight"
    echo "   4. Agent Coordination — Multiple agents using same A2A backend"
    echo ""
    echo -e "${CYAN}Key Insight:${NC}"
    echo "   APIs aren't just for humans anymore. In the agent era, APIs must:"
    echo "   • Be discoverable (agent cards, schemas)"
    echo "   • Support autonomous operation (agents making decisions)"
    echo "   • Enable coordination (multiple agents, one backend)"
    echo ""
    echo -e "${YELLOW}The Architecture as Code Advantage:${NC}"
    echo "   CALM captures this architecture declaratively, showing:"
    echo "   • Agent actors as first-class nodes"
    echo "   • A2A protocol relationships"
    echo "   • Tool discovery interfaces"
    echo "   • Autonomous vs. human-facing agents"
    echo ""
fi

echo ""

# ============================================================================
# Cleanup Instructions
# ============================================================================

clear
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✓ Scenario 5 Complete!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}To clean up:${NC}"
echo "   1. Stop rebalancer agent (Ctrl+C in its terminal)"
echo "   2. Stop UI agent: docker rm -f qcon-agent-ui"
echo "   3. Stop port-forward (Ctrl+C in its terminal)"
echo "   4. Delete deployments (from the scenario5 folder):"
echo "      cd $(pwd) && kubectl delete -k ."
echo ""

echo "Press Enter to exit..."
read
