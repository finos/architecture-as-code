#!/bin/bash

export BAT_THEME="zenburn"

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
# Reset color
NC='\033[0m'

# ============================================================================
# DEPENDENCY VERIFICATION
# ============================================================================

# Track dependency status (using arrays compatible with bash 3.2+)
REQUIRED_COMMANDS=("minikube" "kubectl" "calm" "bash" "bat" "tree" "npm" "node")
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
        bash)
            version_output=$(bash --version 2>&1 | head -1 | sed -n 's/.*version \([0-9.]*\).*/\1/p')
            ;;
        bat)
            version_output=$(bat --version 2>&1 | awk '{print $2}')
            ;;
        tree)
            version_output=$(tree --version 2>&1 | head -1 | grep -o 'v[0-9.]*' | head -1)
            ;;
        npm)
            version_output=$(npm --version 2>&1)
            ;;
        node)
            version_output=$(node --version 2>&1)
            ;;
        *)
            version_output="installed"
            ;;
    esac
    
    # Trim whitespace
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
    
    # Display immediately
    if [ "$status" = "✓" ]; then
        printf "${GREEN}%-15s %-8s${NC} %-40s\n" "$cmd" "$status" "$version"
    else
        printf "${RED}%-15s %-8s${NC} %-40s\n" "$cmd" "$status" "$version"
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         CALM Workshop Environment Verification                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check all required dependencies and display report
echo -e "${YELLOW_BOLD}Checking Required Dependencies...${NC}"
echo ""

printf "%-15s %-8s %-40s\n" "Command" "Status" "Version/Details"
echo "────────────────────────────────────────────────────────────────────"

for cmd in "${REQUIRED_COMMANDS[@]}"; do
    check_and_display_command "$cmd"
done

echo ""
echo "────────────────────────────────────────────────────────────────────"

# Summary
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
    echo "  - bat:      brew install bat (macOS) or apt install bat (Linux)"
    echo "  - tree:     brew install tree (macOS) or apt install tree (Linux)"
    echo "  - npm/node: https://nodejs.org/"
    echo ""
    echo -e "${RED}Cannot proceed without all required dependencies. Exiting.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ All dependencies are installed${NC}"
    echo ""
    echo -e "${GREEN}Environment is ready for the CALM workshop!${NC}"
    echo ""
    echo "Press Enter to begin the demo..."
    read
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Starting CALM Workshop Demo                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
sleep 2

# ============================================================================
# END DEPENDENCY VERIFICATION
# ============================================================================

heading() {
    clear
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

heading "Preparing the environment for the demo..."
info "Destroy Previous Deployments"...
minikube stop --profile insecure
minikube stop --profile secure

cd insecure-example/cluster
command "Starting Minikube..."
./cluster_start.sh
command "Deploying Handcrafted Architecture"
cd ../kubernetes
kubectl apply -k .

heading "Browser Demo"
info "Let's take a look"
error "Start Minikube Tunnel"

success "Let's verify the environment"
read
command "kubectl get pods -n conference"
kubectl get pods -n conference
read
command "kubectl get services -n conference"
kubectl get services -n conference
read
command "kubectl run -it --rm --image=nicolaka/netshoot test-pod -- bash"
kubectl run -it --rm --image=nicolaka/netshoot --image-pull-policy=IfNotPresent test-pod -- bash
read

error "It's very broken"
info "1) Easy to create something custom that doesn't need be"
info "2) Easy to do do the wrong thing as a developer"
info "3) Lots of repeated time for infrastructure setups"
success "There must be a better way?"
read
minikube stop --profile insecure
cd ../../
cached/cluster_start.sh

#Show the CALM CLI commands

heading "Using CALM CLI"
command "calm"
calm
read

#Look at a pattern file
heading "Patterns and Controls"
info "Let's look at a pattern file"
read
bat conference-secure-signup.pattern.json --line-range 80:113 --line-range 162:200 --line-range 290:329 --highlight-line 101:106 --highlight-line 192:200 --highlight-line 311:329

info "Let's look at the Kubernetes cluster control requirement"
read
bat controls/micro-segmentation.requirement.json --line-range 0:35 --highlight-line 21:26
info "Let's look at the control configuration"
read
bat controls/micro-segmentation.config.json --line-range 0:9 --highlight-line 7:8
info "Let's look at a control requirement to permit a connection"
read
bat controls/permitted-connection.requirement.json --line-range 12:27 --highlight-line 21:27
info "Let's look at the basic configuration"
read
bat controls/permitted-connection-http.config.json --line-range 0:8 --highlight-line 6:7
read

#Generate an Architecture
heading "Generating an architecture"
command "calm generate -p conference-secure-signup.pattern.json -o architecture.json"
calm generate -p conference-secure-signup.pattern.json -o architecture.json
read
info "Let's look at the architecture"
bat architecture.json --line-range 29:42 --line-range 61:72 --line-range 106:127 --highlight-line 34:37 --highlight-line 70:71 --highlight-line 124:125
read

#Run a Validate
heading "Validating an Architecture"
command "calm validate -p conference-secure-signup.pattern.json -a architecture.json"
read
calm validate -p conference-secure-signup.pattern.json -a architecture.json
read

#Show Placeholders, fill placeholders
heading "Populating Architectures and Using Templates"
info "Here's one I made earlier..."
bat architecture/conference-secure-signup-amended.arch.json --line-range 29:41 --highlight-line 34:37
read

info "Template Bundle Directory"
tree secure-infra-template-bundle
read

#Generate an architecture
bat secure-infra-template-bundle/application-deployment.yaml --highlight-line 16:19
read

heading "Creating a Kubernetes Deployment"
command "calm template \
           --architecture architecture/conference-secure-signup-amended.arch.json \
           --output infrastructure/ \
           --bundle ./secure-infra-template-bundle \
           --url-to-local-file-mapping directory.json"

calm template \
           --architecture architecture/conference-secure-signup-amended.arch.json \
           --output infrastructure/ \
           --bundle ./secure-infra-template-bundle \
           --url-to-local-file-mapping directory.json
read

heading "Looking at the generated content"
info "1) Cluster Setup"
bat infrastructure/cluster/cluster_start.sh --line-range 0:13 --highlight-line 10 --highlight-line 13
read
info "2) Kubernetes Deployment"
bat infrastructure/kubernetes/application-deployment.yaml --line-range 0:19
read
info "3) Controls Applied"
bat infrastructure/kubernetes/permit-lb-to-app.yaml --line-range 0:12
read

#Start the Cluster
chmod 755 infrastructure/cluster/cluster_start.sh
command "infrastructure/cluster/cluster_start.sh"
info "Cache version executed earlier, to save time"
read

#Deploy the Application
command "kubectl apply -k infrastructure/kubernetes"
kubectl apply -k infrastructure/kubernetes
read

heading "Lets re-assess the previous vulnerability"
command "kubectl -n conference run -it --rm --image=nicolaka/netshoot test-pod -- bash"
kubectl -n conference run -it --rm --image=nicolaka/netshoot --image-pull-policy=IfNotPresent test-pod -- bash
read
info "Let's verify the website is still working"
error "Reset Minikube Tunnel"
read

#Show start Infa
heading "Calm Hub"
read

#Show Docify (pre-canned)
heading "CALM Docify Demo"
command "calm docify --architecture architecture/conference-secure-signup-amended.arch.json --output website --url-to-local-file-mapping directory.json"
command "cd website"
command "npm install"
command "npm run start"
read
calm docify --architecture architecture/conference-secure-signup-amended.arch.json --output website --url-to-local-file-mapping directory.json
cd website
npm install
npm run start
read

#Cleanup
command "Clean Up, Time for a drink"
read
cd ..
kubectl delete -k infrastructure/kubernetes
rm -rf infrastructure
rm architecture.json
minikube stop --profile secure