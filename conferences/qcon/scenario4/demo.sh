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

run_command() {
    local text=$1
    echo -e "${GREEN}> ${text}${NC}"
}

run_command_verbose() {
    local text=$1
    if [ "$VERBOSE_MODE" == "true" ]; then
        echo -e "${GREEN}> ${text}${NC}"
    fi
}

error_msg() {
    local text=$1
    echo -e "${RED}${text}\033[0m\n"
}

success() {
    local text=$1
    echo -e "${GREEN}${text}${NC}\n"
}

section() {
    local text=$1
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ${text}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Ensure we're in the scenario4 directory
cd "$(dirname "$0")"

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}� Mode: Story (commands + explanations)${NC}"
else
    echo -e "${CYAN}⚡ Mode: Concise (commands only)${NC}"
fi
echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}🎯 The Scenario:${NC}"
    echo "   Platform team discovers a cluster stability issue:"
    echo "   Pods without resource limits can consume unbounded CPU/memory"
    echo ""
    echo -e "${RED}The Old Way:${NC}"
    echo "   • Platform team writes documentation"
    echo "   • Sends mandate to 200 teams"
    echo "   • Each team manually edits their YAML"
    echo "   • PRs raised, reviews happen, some teams forget"
    echo "   • 6 months later: audit finds 40% didn't comply"
    echo ""
    echo -e "${GREEN}The Architecture as Code Way:${NC}"
    echo "   • Platform team releases bundle v2 with resource limits"
    echo "   • Teams regenerate: calm template --bundle bundle-v2"
    echo "   • Architecture unchanged, infrastructure gets platform defaults"
    echo "   • Result: 100% compliance in days, not months"
    echo ""
    echo -e "${CYAN}Key Insight:${NC}"
    echo "   Architecture = WHAT (the system design, stable)"
    echo "   Bundle = HOW (platform's opinion, evolves)"
    echo ""
    echo "   This is the log4j analogy: teams upgrade the dependency (bundle),"
    echo "   they don't rewrite application code (architecture)"
    echo ""
fi
echo "Press Enter to begin..."
read

# ============================================================================
# Beat 1: Show the problem - no resource limits
# ============================================================================


section "The Problem"

heading "📋 Current State: Pods Without Resource Limits"
info "The cluster from Scenario 3 is running..."
info "Let's check if pods have resource limits defined"
echo ""

run_command "kubectl get pods"
kubectl get pods
echo ""

run_command "kubectl describe pod -l app=trades-mcp-server | grep -A6 'Limits:'"
echo ""
kubectl describe pod -l app=trades-mcp-server | grep -A6 "Limits:" || echo -e "${RED}No resource limits defined!${NC}"
echo ""

error_msg "⚠️  Problem Identified:"
echo -e "${RED}  • No CPU limits: pods can consume entire node's CPU${NC}"
echo -e "${RED}  • No memory limits: OOM risk for other pods${NC}"
echo -e "${RED}  • Cluster stability at risk${NC}"
echo ""

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Without limits, a runaway pod can impact the entire cluster"
    info "Platform team needs to enforce resource governance"
fi

echo "Press Enter to see how the platform team responds..."
read

# ============================================================================
# Beat 2: Platform team releases bundle v2
# ============================================================================

clear
section "Platform Team Action"

heading "🔧 Platform Team Releases Bundle v2"
info "Platform team encodes resource limits as platform opinion"
info "They update the deployment templates in the bundle"
echo ""

run_command "diff -u bundle-v1/mcp-deployment.yaml bundle-v2/mcp-deployment.yaml"
echo ""
echo -e "${CYAN}Changes to mcp-deployment.yaml:${NC}"
diff -u bundle-v1/mcp-deployment.yaml bundle-v2/mcp-deployment.yaml | tail -n 15 | bat --language diff --style=plain --color=always
echo ""

success "✅ Bundle v2 Released"
echo -e "${GREEN}Platform defaults added:${NC}"
echo -e "  • CPU request: 250m, limit: 500m"
echo -e "  • Memory request: 128Mi, limit: 256Mi"
echo ""
echo -e "${CYAN}Key Point:${NC}"
echo "  These limits are NOT in the architecture"
echo "  They are the platform's opinion of how to run workloads"
echo "  Teams consume this opinion by using the bundle and platform"
echo ""

if [ "$VERBOSE_MODE" == "true" ]; then
    info "The architecture JSON never mentioned CPU or memory"
    info "That's not what the architecture is about"
    info "The bundle is the platform's contract for HOW to deploy"
fi

echo "Press Enter to see what teams need to do..."
read

# ============================================================================
# Same architecture, new bundle → different output
# ============================================================================

clear
section "Team Regenerates Infrastructure"

heading "🔄 Team Action: Regenerate with Bundle v2"
info "Team's architecture file is UNCHANGED"
info "Only the bundle parameter changes in the calm template command"
echo ""

run_command "cd calm && calm template --architecture trades-api-and-mcp-conforming.architecture.json --bundle ../bundle-v2 --output ../generated"
cd calm && calm template \
    --architecture trades-api-and-mcp-conforming.architecture.json \
    --output ../generated \
    --bundle ../bundle-v2 \
    --clear-output-directory > /dev/null 2>&1
cd ..
echo ""

success "✅ Infrastructure regenerated with bundle v2"
echo ""

heading "� Generated Resources:"
run_command "tree generated"
tree generated
echo ""

heading "�📦 Compare Generated Deployment"
info "The generated deployment now contains resource limits"
echo ""

run_command "grep -A10 'resources:' generated/kubernetes/mcp-deployment.yaml"
echo ""
grep -A10 "resources:" generated/kubernetes/mcp-deployment.yaml | bat --language yaml --style=plain --color=always
echo ""

success "✅ Platform defaults automatically injected"
echo ""
echo "Press Enter to deploy the updated infrastructure..."
read

# ============================================================================
# Deploy and verify
# ============================================================================

clear
section "Deploy and Verify"

heading "🚀 Deploy Updated Infrastructure"
run_command "kubectl apply -k generated/kubernetes"
kubectl apply -k generated/kubernetes > /dev/null 2>&1
echo ""

run_command "kubectl rollout restart deployment/trades-mcp-server"
kubectl rollout status deployment/trades-mcp-server --timeout=90s
echo ""

success "✅ Deployment rolled out"
echo "Press Enter to verify resource limits..."
read

heading "🔍 Verify Resource Limits"
run_command "kubectl describe pod -l app=trades-mcp-server | grep -A6 'Limits:'"
echo ""
kubectl describe pod -l app=trades-mcp-server | grep -A6 "Limits:"
echo ""

success "✅ Resource limits now enforced!"
echo -e "${GREEN}Results:${NC}"
echo -e "  • CPU: 500m limit ✓"
echo -e "  • Memory: 256Mi limit ✓"
echo -e "  • Cluster stability improved ✓"
echo ""

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✓ Scenario 4 Complete!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
