#!/bin/bash

# Check if verbose mode is set (from parent script)
VERBOSE_MODE=${VERBOSE_MODE:-"true"}

# Ensure we're in the scenario2 directory
cd "$(dirname "$0")"

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
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

error() {
    local text=$1
    echo -e "${RED}${text}${NC}\n"
}

command() {
    local text=$1
    echo -e "${GREEN}> ${text}${NC}\n"
}

command_verbose() {
    local text=$1
    if [ "$VERBOSE_MODE" == "true" ]; then
        echo -e "${GREEN}> ${text}${NC}\n"
    fi
}


if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${BLUE}📖 Mode: Story (commands + explanations)${NC}"
else
    echo -e "${BLUE}⚡ Mode: Concise (commands only)${NC}"
fi
echo ""

# clear
heading "Step 1: Verify existing deployment"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Checking for running pods from Scenario 1..."
    info "Why: Scenario 2 builds on the infrastructure from Scenario 1"
fi
command "kubectl get pods"
kubectl get pods 2>/dev/null || {
    echo "Error: No kubernetes cluster found. Please run scenario 1 first."
    exit 1
}
echo ""
success "✓ Cluster verified"
echo ""
echo "Press Enter to continue..."
read

clear
heading "Step 2: Display the MCP Guardrail Control"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "The control defines denied trading symbols (VOD, GME, AMC)..."
    info "Why: CALM controls codify governance requirements declaratively"
fi
command "cat calm/controls/mcp-guardrail.config.json"
cat calm/controls/mcp-guardrail.config.json | bat --language json --style=plain --color=always
echo ""

echo "Press Enter to continue..."
read

clear
info "Where is this control applied in the architecture?"
echo ""
echo -e "${BLUE}In the trades-api-and-mcp.architecture.json, the mcp-server node declares:${NC}"
echo -e "${CYAN}(Highlighting the 'controls' section on lines 15-25)${NC}"
echo ""
sed -n '/"unique-id": "mcp-server"/,/^    },$/p' calm/trades-api-and-mcp.architecture.json | bat --language json --style=plain --color=always --highlight-line 15:25
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Note: The controls section links to both requirement and config files"
    info "This declaratively ties governance policy to the service"
fi
echo ""
echo "Press Enter to continue..."
read

clear
heading "Step 3: Generate infrastructure from CALM architecture"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Using CALM to extract denied symbols from control configuration..."
    info "Why: CALM transforms declarative controls into executable artifacts"
fi
command "cd calm && calm template --architecture trades-api-and-mcp.architecture.json --bundle ../bundle --output ../infrastructure"
cd calm && calm template \
    --architecture trades-api-and-mcp.architecture.json \
    --output ../infrastructure \
    --bundle ../bundle \
    --clear-output-directory
cd ..
echo ""
success "✓ Infrastructure generated"
echo ""
echo "Press Enter to continue..."
read


tree infrastructure/kubernetes
echo ""
echo "Press Enter to continue..."
read

clear
heading "Step 4: Show generated ConfigMap"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "ConfigMap generated from control configuration:"
    info "Why: The bundle transforms CALM controls into Kubernetes resources"
fi
info "ConfigMap generated from control configuration:"
command "cat infrastructure/kubernetes/denied-symbols-configmap.yaml"
cat infrastructure/kubernetes/denied-symbols-configmap.yaml | bat --language yaml --style=plain --color=always
echo ""
echo "Press Enter to apply the configuration..."
read

tree infrastructure/kubernetes
echo ""

clear
heading "Step 5: Apply the new configuration"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Applying updated Kubernetes resources with MCP guardrail..."
    info "Why: kubectl apply updates the ConfigMap, then restart MCP to load new values"
fi
command "kubectl apply -k infrastructure/kubernetes"
kubectl apply -k infrastructure/kubernetes
kubectl rollout restart deployment/trades-mcp-server 
echo ""
success "✓ Configuration applied"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Note: Only MCP server is restarted - trades service doesn't use the ConfigMap"
fi
echo ""
echo "Press Enter to continue..."
read

clear
heading "Step 6: Wait for pods to be ready"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Waiting for MCP deployment to complete rollout..."
    info "Why: MCP needs to restart to pick up the new denied symbols ConfigMap"
fi
kubectl rollout status deployment/trades-mcp-server --timeout=90s
echo ""
success "✓ All deployments rolled out successfully"
echo ""
echo "Press Enter to continue..."
read

clear
heading "Step 7: Verify deployment"
info "Current pods:"
command "kubectl get pods -o wide"
kubectl get pods -o wide
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "The MCP guardrail is now active, blocking trades for VOD, GME, AMC"
fi
echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 8: Verify Port Forwarding After Restart
# ============================================================================

clear
heading "Step 8: Verify Port Forwarding"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "After restarting deployments, we need to ensure port-forwards are still active..."
    info "Why: Pod restarts may require re-establishing port-forward connections"
fi
echo ""
info "Checking existing port-forwards from Scenario 1..."
echo ""
echo -e "${YELLOW}If needed, restart port-forward from scenario1:${NC}"
echo -e "${CYAN}  cd ../scenario1 && ./port-forward.sh${NC}"
echo ""

# Verify port-forwards with 2 attempts
for attempt in 1 2; do
    echo "Verifying port-forwards (Attempt $attempt of 2)..."
    echo ""
    MCP_OK=false
    TRADES_OK=false

    if curl -s http://localhost:8080/health > /dev/null 2>&1 || curl -s http://localhost:8080/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ MCP Server accessible at localhost:8080${NC}"
        MCP_OK=true
    else
        echo -e "${RED}✗ MCP Server NOT accessible at localhost:8080${NC}"
    fi

    if curl -s http://localhost:8081/health > /dev/null 2>&1 || curl -s http://localhost:8081/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Trades API accessible at localhost:8081${NC}"
        TRADES_OK=true
    else
        echo -e "${RED}✗ Trades API NOT accessible at localhost:8081${NC}"
    fi

    echo ""
    if [ "$MCP_OK" = true ] && [ "$TRADES_OK" = true ]; then
        success "✓ All port-forwards active"
        break
    elif [ $attempt -eq 1 ]; then
        echo -e "${YELLOW}REMINDER: You may need to restart Scenario 1 port-forward in a separate terminal:${NC}"
        echo -e "  ${CYAN}cd ../scenario1 && ./port-forward.sh${NC}"
        echo ""
        echo "Press Enter to retry verification..."
        read
    else
        echo -e "${RED}✗ Still cannot reach services after 2 attempts. Please verify scenario1/port-forward.sh is running.${NC}"
        echo "Press Enter to continue anyway..."
        read
    fi
done
echo ""
echo "Press Enter to continue..."
read

clear
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✓ Scenario 2 Complete!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
