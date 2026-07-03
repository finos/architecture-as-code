#!/bin/bash

export BAT_THEME="zenburn"

# Check if verbose mode is set (from parent script)
VERBOSE_MODE=${VERBOSE_MODE:-"true"}

# Ensure we're in the scenario1 directory
cd "$(dirname "$0")"

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
# Reset color
NC='\033[0m'

# ============================================================================
# DEPENDENCY VERIFICATION
# ============================================================================

REQUIRED_COMMANDS=("minikube" "kubectl" "calm" "bat" "tree")
MISSING_DEPS=()
MISSING_CRITICAL=0

get_version() {
    local cmd=$1
    local version_output=""

    case "$cmd" in
        minikube)
            version_output=$(minikube version --short 2>&1)
            ;;
        kubectl)
            version_output=$(kubectl version --client 2>&1 | head -1 | awk '{print $3}')
            ;;
        calm)
            version_output=$(calm --version 2>&1)
            ;;
        bat)
            version_output=$(bat --version 2>&1 | awk '{print $2}')
            ;;
        tree)
            version_output=$(tree --version 2>&1 | head -1 | grep -o 'v[0-9.]*' | head -1)
            ;;
        *)
            version_output="installed"
            ;;
    esac

    version_output=$(echo "$version_output" | xargs)

    if [ -z "$version_output" ]; then
        echo "installed"
    else
        echo "$version_output"
    fi
}

check_and_display_command() {
    local cmd=$1
    local status="✗"
    local version="NOT FOUND"

    if command -v "$cmd" &> /dev/null; then
        status="✓"
        version=$(get_version "$cmd")
    else
        MISSING_DEPS+=("$cmd")
        MISSING_CRITICAL=1
    fi

    if [ "$status" = "✓" ]; then
        printf "${GREEN}%-15s %-8s${NC} %-40s\n" "$cmd" "$status" "$version"
    else
        printf "${RED}%-15s %-8s${NC} %-40s\n" "$cmd" "$status" "$version"
    fi
}
echo -e "${YELLOW_BOLD}Checking Required Dependencies...${NC}"
echo ""

printf "%-15s %-8s %-40s\n" "Command" "Status" "Version/Details"
echo "────────────────────────────────────────────────────────────────────"

for cmd in "${REQUIRED_COMMANDS[@]}"; do
    check_and_display_command "$cmd"
done

echo ""
echo "────────────────────────────────────────────────────────────────────"

if [ "$MISSING_CRITICAL" -eq 1 ]; then
    echo -e "${RED}✗ REQUIRED DEPENDENCIES MISSING${NC}"
    echo ""
    echo "The following required dependencies are missing:"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "  ${RED}• $dep${NC}"
    done
    echo ""
    echo "Installation instructions:"
    echo "  - minikube: https://minikube.sigs.k8s.io/docs/start/"
    echo "  - kubectl:  https://kubernetes.io/docs/tasks/tools/"
    echo "  - calm:     npm install -g @finos/calm-cli"
    echo "  - bat:      brew install bat"
    echo "  - tree:     brew install tree"
    echo ""
    echo -e "${RED}Cannot proceed without all required dependencies. Exiting.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ All dependencies are installed${NC}"
    echo ""
    echo -e "${GREEN}Environment is ready for the QCon Trades Demo!${NC}"
    echo ""
    echo "Press Enter to begin the demo..."
    read
fi

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${BLUE}� Mode: Story (commands + explanations)${NC}"
else
    echo -e "${BLUE}⚡ Mode: Concise (commands only)${NC}"
fi
# ============================================================================
# END DEPENDENCY VERIFICATION
# ============================================================================

heading() {
    local text=$1
    echo -e "${YELLOW_BOLD}${text}${NC}\n"
}

info() {
    local text=$1
    echo -e "${YELLOW}${text}${NC}\n"
}

error() {
    local text=$1
    echo -e "${RED}${text}\033[0m\n"
}

success() {
    local text=$1
    echo -e "${GREEN}${text}${NC}\n"
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

# ============================================================================
# STEP 1: Start Minikube
# ============================================================================

clear
heading "Starting the Kubernetes Cluster"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Minikube with secure profile and Calico CNI..."
    info "Why: Calico provides network policies for micro-segmentation"
fi
command "minikube start --profile secure --cni calico"
minikube start --profile secure --cni calico
echo ""
success "✓ Cluster ready"
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 2: Load Docker images
# ============================================================================


heading "Preparing Docker Images"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Loading images into Minikube's daemon..."
    info "Why: imagePullPolicy: Never requires images to be pre-loaded locally"
    command "minikube image load jpgough/trades-mcp-server:latest --profile secure"
    minikube image load jpgough/trades-mcp-server:latest --profile secure
    command "minikube image load jpgough/trades-rest-server:latest --profile secure"
    minikube image load jpgough/trades-rest-server:latest --profile secure
    command "minikube image load jpgough/trades-a2a-server:latest --profile secure"
    minikube image load jpgough/trades-a2a-server:latest --profile secure
    echo ""
    success "✓ Images ready in Minikube's daemon"
else
    info "Skipping image loading (only needed in verbose mode)"
fi
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 3: Generate Infrastructure via calm template
# ============================================================================

# clear
heading "Generate Infrastructure from CALM Architecture"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Using CALM to transform architecture definitions into Kubernetes manifests..."
    info "Why: Architecture as Code turns CALM JSON into deployable infrastructure"
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
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 4: Deploy
# ============================================================================


heading "Deploying to Kubernetes"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Applying generated Kubernetes resources..."
    info "Why: kubectl apply creates all resources defined in the manifests"
fi
command "kubectl apply -k infrastructure/kubernetes"
kubectl apply -k infrastructure/kubernetes
echo ""
success "✓ Resources deployed"
echo "Press Enter to continue..."
read


# ============================================================================
# STEP 5: Generated Artifacts
# ============================================================================

clear
heading "Generated Infrastructure Artifacts"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Viewing the complete infrastructure generated from CALM..."
fi
command "tree infrastructure"
tree infrastructure
echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 6: Active Pods
# ============================================================================


heading "Active Pods"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "Waiting for all pods to become ready..."
    info "Why: Readiness probes must pass before pods can accept traffic"
fi
command "kubectl wait --for=condition=ready pod -l app=trades --timeout=90s"
command "kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=90s"
# Wait a moment for pods to be created after deployment
sleep 2
if kubectl wait --for=condition=ready pod -l app=trades --timeout=90s 2>/dev/null && \
   kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=90s 2>/dev/null; then
    echo ""
    success "✓ All pods ready"
else
    echo "Waiting for pods to be created..."
    sleep 3
    if kubectl wait --for=condition=ready pod -l app=trades --timeout=90s && \
       kubectl wait --for=condition=ready pod -l app=trades-mcp-server --timeout=90s; then
        echo ""
        success "✓ All pods ready"
    else
        echo ""
        error "Failed to wait for pods to be ready"
        echo "Checking current pod status..."
        kubectl get pods
        exit 1
    fi
fi
echo "Press Enter to continue..."
read
command "kubectl get pods -o wide"
kubectl get pods -o wide
echo "Press Enter to continue..."
read

# ============================================================================
# STEP 7: Setup Port Forwarding
# ============================================================================


heading "Setting Up Port Forwarding"
if [ "$VERBOSE_MODE" == "true" ]; then
    info "To access the deployed services, we need to set up port forwarding..."
    info "Why: Services run as ClusterIP and need port-forward for local access"
fi
echo ""
echo -e "${YELLOW_BOLD}In a SEPARATE terminal, run (from the scenario1 folder):${NC}"
echo -e "${GREEN}  cd $(pwd)${NC}"
echo -e "${GREEN}  ./port-forward.sh${NC}"
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    info "This will make services available at:"
    echo "  • MCP Server:  http://localhost:8080"
    echo "  • Trades API:  http://localhost:8081"
    echo "  • A2A Server:  http://localhost:9103"
else
    echo "Services will be available at:"
    echo "  • MCP Server:  http://localhost:8080"
    echo "  • Trades API:  http://localhost:8081"
    echo "  • A2A Server:  http://localhost:9103"
fi
echo ""
echo -e "${YELLOW_BOLD}Press Enter once port-forwarding is running...${NC}"
read

# Verify port-forwards with 2 attempts
for attempt in 1 2; do
    echo "Verifying port-forwards (Attempt $attempt of 2)..."
    echo ""
    MCP_OK=false
    TRADES_OK=false
    A2A_OK=false

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

    if curl -s http://localhost:9103/q/health > /dev/null 2>&1 || curl -s http://localhost:9103/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ A2A Server accessible at localhost:9103${NC}"
        A2A_OK=true
    else
        echo -e "${RED}✗ A2A Server NOT accessible at localhost:9103${NC}"
    fi

    echo ""
    if [ "$MCP_OK" = true ] && [ "$TRADES_OK" = true ] && [ "$A2A_OK" = true ]; then
        success "✓ Port-forwarding confirmed - all services accessible"
        break
    elif [ $attempt -eq 1 ]; then
        echo -e "${YELLOW}Port-forwards not detected. Please ensure ./port-forward.sh is running.${NC}"
        echo "Press Enter to retry verification..."
        read
    else
        echo -e "${RED}✗ Port-forwards still not detected after 2 attempts${NC}"
        echo "Press Enter to continue anyway..."
        read
    fi
done
echo ""

clear
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✓ Scenario 1 Complete!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# DEPLOYMENT COMPLETE
# ============================================================================
