#!/bin/bash

# ANSI color codes
YELLOW='\033[0;33m'
YELLOW_BOLD='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

error() {
    local text=$1
    echo -e "${RED}${text}${NC}\n"
}

section() {
    local text=$1
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  $text"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

clear

# ============================================================================
# MODE SELECTION
# ============================================================================

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                   Select Demo Mode                                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Choose your experience:${NC}"
echo ""
echo -e "  ${GREEN}1${NC} - ${YELLOW}Concise Mode${NC} (Recommended for presentations)"
echo "      • Show all technical commands (calm, kubectl, minikube, calmhub)"
echo "      • Focus on WHAT is happening, not WHY"
echo "      • Streamlined for live demos"
echo ""
echo -e "  ${GREEN}2${NC} - ${YELLOW}Story Mode${NC} (Recommended for learning/teaching)"
echo "      • Show all technical commands AND explanations"
echo "      • Context about why each step matters"
echo "      • Full narrative for understanding"
echo ""
read -p "Enter your choice (1 or 2) [default: 1]: " MODE_CHOICE

# Default to concise mode
MODE_CHOICE=${MODE_CHOICE:-1}

if [ "$MODE_CHOICE" == "2" ]; then
    export VERBOSE_MODE="true"
    echo -e "${GREEN}✓ Story mode enabled${NC}"
else
    export VERBOSE_MODE="false"
    echo -e "${GREEN}✓ Concise mode enabled${NC}"
fi
echo ""
sleep 1

clear

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                                   ║${NC}"
echo -e "${CYAN}║      APIs for Agents                                              ║${NC}"
echo -e "${CYAN}║                                                                   ║${NC}"
echo -e "${CYAN}║  Scenario 1: Deploy API & MCP Architecture                        ║${NC}"
echo -e "${CYAN}║  Scenario 2: Introducing Controls and Governance                  ║${NC}"
echo -e "${CYAN}║  Scenario 3: Gating Deployments                                   ║${NC}"
echo -e "${CYAN}║  Scenario 4: Scaling Deployments and Operational Change           ║${NC}"
echo -e "${CYAN}║  Scenario 5: Rapid Platform Adoption                              ║${NC}"
echo -e "${CYAN}║                                                                   ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
sleep 2

if [ "$VERBOSE_MODE" == "true" ]; then
    info "APIs aren't just consumed by human developers anymore —"
    info "they're consumed by tools and autonomous agents."
    echo ""
    info "This demo shows how Architecture as Code enables:"
    echo "  1️⃣  Deploy standardized API infrastructure"
    echo "  2️⃣  Declare controls and governance requirements in architecture"
    echo "  3️⃣  Gate deployments with automated validation"
    echo "  4️⃣  Scale platform changes without architecture churn"
    echo "  5️⃣  Rapidly adopt new platform capabilities (A2A protocol)"
    echo ""
    info "The Challenge:"
    echo "   • 200+ APIs need consistent security controls"
    echo "   • Agent consumers require runtime guardrails"
    echo "   • Teams must move fast without creating drift"
    echo ""
    info "The Solution:"
    echo "   • Codify architectural patterns in CALM"
    echo "   • Self-service controls teams can apply immediately"
    echo "   • Automated validation gates that scale"
    echo ""
    echo -e "${CYAN}Note: Port-forwarding is handled by scenario1/port-forward.sh${NC}"
    echo -e "${CYAN}Start it in a separate terminal after Scenario 1 completes:${NC}"
    echo -e "${GREEN}  cd $(pwd)/scenario1 && ./port-forward.sh${NC}"
    echo ""
fi
read -p "Press Enter to begin..."

# ============================================================================
# SCENARIO 1: Basic Deployment
# ============================================================================

section "SCENARIO 1: Deploy API & MCP Architecture"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Scenario 1: The Foundation"
    info "Deploying a Trades API with MCP server for agent consumption"
    echo ""
fi

cd scenario1

# Check if demo.sh exists
if [ ! -f "demo.sh" ]; then
    error "Error: scenario1/demo.sh not found!"
    exit 1
fi

# Make sure it's executable
chmod +x demo.sh

# Run scenario 1
./demo.sh

# Check if scenario 1 completed successfully
if [ $? -ne 0 ]; then
    error "Scenario 1 failed. Exiting."
    exit 1
fi

cd ..

echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}Achievement: API infrastructure deployed from architecture definition${NC}"
    echo ""
    echo -e "${CYAN}Reminder: Start port-forwarding in separate terminal if you haven't already:${NC}"
    echo -e "${GREEN}  cd $(pwd)/scenario1 && ./port-forward.sh${NC}"
    echo ""
fi
echo -e "${YELLOW_BOLD}Press Enter to continue to Scenario 2...${NC}"
read
clear

# ============================================================================
# TRANSITION
# ============================================================================

section "SCENARIO 2: Introducing Controls and Governance"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Scenario 2: Controls and Governance in Architecture"
    echo ""
fi

cd scenario2

# Check if demo.sh exists
if [ ! -f "demo.sh" ]; then
    error "Error: scenario2/demo.sh not found!"
    exit 1
fi

# Make sure it's executable
chmod +x demo.sh

# Run scenario 2
./demo.sh

# Check if scenario 2 completed successfully
if [ $? -ne 0 ]; then
    error "Scenario 2 failed."
    exit 1
fi

cd ..

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}Achievement: Controls codified and governance requirements declared${NC}"
    echo -e "${GREEN}Architecture includes MCP guardrails and security controls${NC}"
    echo ""
fi
echo -e "${YELLOW_BOLD}Press Enter to continue to Scenario 3...${NC}"
read
clear
# ============================================================================
# TRANSITION TO SCENARIO 3
# ============================================================================

section "SCENARIO 3: Gating Deployments"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Scenario 3: Automated Governance Gates Block Non-Compliant Deployments"
    echo ""
fi

cd scenario3

# Check if demo.sh exists
if [ ! -f "demo.sh" ]; then
    error "Error: scenario3/demo.sh not found!"
    exit 1
fi

# Make sure it's executable
chmod +x demo.sh

# Run scenario 3 with retry handling (max 3 attempts)
SCENARIO3_ATTEMPTS=0
SCENARIO3_MAX=3
while [ $SCENARIO3_ATTEMPTS -lt $SCENARIO3_MAX ]; do
    SCENARIO3_ATTEMPTS=$((SCENARIO3_ATTEMPTS + 1))
    ./demo.sh

    if [ $? -eq 0 ]; then
        break
    fi

    if [ $SCENARIO3_ATTEMPTS -ge $SCENARIO3_MAX ]; then
        error "Scenario 3 failed after $SCENARIO3_MAX attempts. Stopping demo flow."
        exit 1
    fi

    SCENARIO3_REMAINING=$((SCENARIO3_MAX - SCENARIO3_ATTEMPTS))
    error "Scenario 3 did not complete successfully (attempt $SCENARIO3_ATTEMPTS/$SCENARIO3_MAX)."
    echo ""
    echo "Choose an option:"
    echo "  [1] Retry Scenario 3 ($SCENARIO3_REMAINING attempt(s) remaining)"
    echo "  [2] Quit demo flow"
    read -p "Selection (1/2) [1]: " SCENARIO3_ACTION
    SCENARIO3_ACTION=${SCENARIO3_ACTION:-1}

    case "$SCENARIO3_ACTION" in
        1)
            info "Retrying Scenario 3..."
            ;;
        2)
            error "Demo flow stopped by user during Scenario 3."
            exit 1
            ;;
        *)
            info "Invalid selection; retrying Scenario 3 by default..."
            ;;
    esac
done

cd ..

echo ""

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}Achievement: Deployments automatically gated by governance requirements${NC}"
    echo -e "${YELLOW}Pattern registration and control validations enforced before deployment${NC}"
    echo ""
fi
echo -e "${YELLOW_BOLD}Press Enter to continue to Scenario 4...${NC}"
read

# ============================================================================
# TRANSITION TO SCENARIO 4
# ============================================================================

clear
section "SCENARIO 4: Scaling Deployments and Operational Change"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Scenario 4: Platform Changes Without Architecture Modifications"
    echo ""
fi

cd scenario4

# Check if demo.sh exists
if [ ! -f "demo.sh" ]; then
    error "Error: scenario4/demo.sh not found!"
    exit 1
fi

# Make sure it's executable
chmod +x demo.sh

# Run scenario 4
./demo.sh

# Check if scenario 4 completed successfully
if [ $? -ne 0 ]; then
    error "Scenario 4 failed."
    exit 1
fi

cd ..

echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}Achievement: Platform operational changes scale across all teams${NC}"
    echo -e "${YELLOW}Resource limits and platform policies updated without architecture changes${NC}"
    echo ""
fi
echo -e "${YELLOW_BOLD}Press Enter to continue to Scenario 5...${NC}"
read

# ============================================================================
# TRANSITION TO SCENARIO 5
# ============================================================================

section "SCENARIO 5: Rapid Platform Adoption"

if [ "$VERBOSE_MODE" == "true" ]; then
    info "Starting Scenario 5: Agent-to-Agent Protocol Enables New Platform Capabilities"
    echo ""
fi

cd scenario5

# Check if demo.sh exists
if [ ! -f "demo.sh" ]; then
    error "Error: scenario5/demo.sh not found!"
    exit 1
fi

# Make sure it's executable
chmod +x demo.sh

# Run scenario 5
./demo.sh

# Check if scenario 5 completed successfully
if [ $? -ne 0 ]; then
    error "Scenario 5 failed."
    exit 1
fi

cd ..

echo ""
if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${GREEN}Achievement: New platform capabilities (A2A protocol) adopted rapidly${NC}"
    echo -e "${YELLOW}Autonomous agents leverage APIs with minimal integration effort${NC}"
    echo ""
fi
sleep 3

# ============================================================================
# FINAL SUMMARY
# ============================================================================

section "🎉 ALL SCENARIOS COMPLETE 🎉"

echo ""
success "Congratulations! You've completed all 5 QCon scenarios!"
echo ""

if [ "$VERBOSE_MODE" == "true" ]; then
    echo -e "${CYAN}Summary of what we demonstrated:${NC}"
    echo ""
    echo -e "${GREEN}✓ Scenario 1:${NC} Deployed API & MCP Server architecture"
    echo -e "${GREEN}✓ Scenario 2:${NC} Controls and governance requirements declared"
    echo -e "${GREEN}✓ Scenario 3:${NC} Deployments gated by automated validation"
    echo -e "${GREEN}✓ Scenario 4:${NC} Platform changes scaled without architecture churn"
    echo -e "${GREEN}✓ Scenario 5:${NC} New platform capability (A2A) adopted rapidly"
    echo ""
    echo -e "${YELLOW}Key Takeaways:${NC}"
    echo -e "${YELLOW}• Architecture as Code enables governance automation${NC}"
    echo -e "${YELLOW}• Patterns enforce standards across all implementations${NC}"
    echo -e "${YELLOW}• CALM captures both human and agent actors${NC}"
    echo -e "${YELLOW}• A2A protocol enables autonomous agent coordination${NC}"
    echo ""
fi
echo ""
