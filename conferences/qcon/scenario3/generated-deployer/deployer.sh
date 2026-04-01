#!/bin/bash

# ============================================================================
# CALM-Aware Deployer Script - Validation Gate Only
# ============================================================================
# This script validates CALM architectures before deployment by:
# 1. Checking if required patterns exist in CALM Hub
# 2. Validating the architecture against the pattern using `calm validate`
# 3. Only deploying if validation passes
#
# NOTE: This version removes infrastructure validation gates.
#       Focus is purely on CALM architecture compliance.
# ============================================================================

set -e

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8085}"
NAMESPACE="${NAMESPACE:-QCon}"
ARCHITECTURE_FILE="${ARCHITECTURE_FILE}"
KUSTOMIZE_DIR="${KUSTOMIZE_DIR}"

# ============================================================================
# Helper Functions
# ============================================================================

error() {
    echo -e "${RED}✗ ERROR: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

section() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ============================================================================
# Validation Functions
# ============================================================================

check_calm_hub() {
    info "Checking CALM Hub connectivity..."
    if ! curl -sf "${CALM_HUB_URL}/q/swagger-ui/" > /dev/null 2>&1; then
        error "CALM Hub is not accessible at ${CALM_HUB_URL}"
        error "Please ensure CALM Hub is running (docker-compose up in calm-hub/deploy-qcon)"
        return 1
    fi
    success "CALM Hub is accessible at ${CALM_HUB_URL}"
    return 0
}

extract_pattern_from_schema() {
    local architecture_file=$1
    # Extract pattern name from $schema field
    # Example: "https://calm.finos.org/qcon/scenario3/calm/trades-api-and-mcp.pattern.json"
    # Returns: "trades-api-and-mcp"
    local schema_url=$(jq -r '."$schema" // empty' "$architecture_file")
    
    if [ -z "$schema_url" ]; then
        echo ""
        return
    fi
    
    # Extract pattern name: get basename, remove .pattern.json
    local pattern_name=$(basename "$schema_url" .pattern.json)
    echo "$pattern_name"
}

check_pattern_in_hub() {
    local pattern_name=$1
    
    if [ -z "$pattern_name" ]; then
        error "No pattern specified in architecture \$schema field"
        return 1
    fi
    
    info "Checking if pattern '${pattern_name}' is registered in CALM Hub..."
    info "Namespace: ${NAMESPACE}"
    echo ""
    
    # Get list of pattern IDs from CALM Hub
    local patterns_response=$(curl -s "${CALM_HUB_URL}/calm/namespaces/${NAMESPACE}/patterns" 2>/dev/null)
    
    if [ -z "$patterns_response" ]; then
        error "❌ GATE 1 REJECTED: Cannot retrieve patterns from CALM Hub"
        error "   Namespace: ${NAMESPACE}"
        error "   URL: ${CALM_HUB_URL}"
        return 1
    fi
    
    # Extract pattern IDs from response
    local pattern_ids=$(echo "$patterns_response" | jq -r '.values[]' 2>/dev/null)
    
    if [ -z "$pattern_ids" ]; then
        error "❌ GATE 1 REJECTED: No patterns found in CALM Hub"
        info "   Namespace: ${NAMESPACE}"
        return 1
    fi
    
    info "Found pattern IDs: $pattern_ids"
    echo ""
    
    # Check each pattern to find matching name
    for pattern_id in $pattern_ids; do
        local pattern_data=$(curl -s "${CALM_HUB_URL}/calm/namespaces/${NAMESPACE}/patterns/${pattern_id}/versions/1.0.0" 2>/dev/null)
        
        if [ -n "$pattern_data" ]; then
            local pattern_id_field=$(echo "$pattern_data" | jq -r '."$id" // ""' 2>/dev/null)
            local extracted_name=$(basename "$pattern_id_field" .pattern.json 2>/dev/null)
            
            info "Pattern ID ${pattern_id}: ${extracted_name}"
            
            if [ "$extracted_name" = "$pattern_name" ]; then
                success "✅ GATE 1 PASSED: Pattern '${pattern_name}' found in CALM Hub (namespace: ${NAMESPACE})"
                info "   Pattern is centrally managed - all teams reference the same validated pattern"
                return 0
            fi
        fi
    done
    
    error "❌ GATE 1 REJECTED: Pattern '${pattern_name}' not found in CALM Hub"
    info "   Namespace: ${NAMESPACE}"
    info "   Governance requirement: All patterns must be pre-approved and registered"
    info "   Available patterns: ${CALM_HUB_URL}/calm/namespaces/${NAMESPACE}/patterns"
    return 1
}

validate_architecture() {
    local architecture_file=$1
    
    section "Gate 2: Architecture Validation"
    
    info "Validating architecture against pattern requirements..."
    
    # Extract pattern file from architecture $schema
    local schema_url=$(jq -r '."$schema" // empty' "$architecture_file")
    if [ -z "$schema_url" ]; then
        error "No $schema field found in architecture"
        return 1
    fi
    
    # Extract pattern file path: get basename from URL
    local pattern_basename=$(basename "$schema_url")
    local pattern_file="calm/${pattern_basename}"
    
    info "Running: calm validate --pattern \"$pattern_basename\" --architecture \"$(basename $architecture_file)\""
    echo ""
    
    # Use calm validate command with pattern and architecture flags
    if calm validate --pattern "$pattern_file" --architecture "$architecture_file" 2>&1; then
        echo ""
        success "✅ GATE 2 PASSED: Architecture validation passed"
        info "   Architecture conforms to pattern requirements"
        return 0
    else
        echo ""
        error "❌ GATE 2 REJECTED: Architecture validation failed"
        info "   Architecture does not conform to pattern requirements"
        info "   Common issues: missing controls, incorrect node types, relationship violations"
        return 1
    fi
}
        echo ""
        error "❌ GATE 2 REJECTED: Architecture validation failed"
        info "   Architecture does not conform to pattern requirements"
        info "   Common issues: missing controls, incorrect node types, relationship violations"

# ============================================================================
# Main Execution
# ============================================================================

main() {
    if [ -z "$ARCHITECTURE_FILE" ] || [ -z "$KUSTOMIZE_DIR" ]; then
        error "Usage: ARCHITECTURE_FILE=<arch.json> KUSTOMIZE_DIR=<dir> $0"
        error "Or set environment variables: ARCHITECTURE_FILE and KUSTOMIZE_DIR"
        exit 1
    fi
    
    if [ ! -f "$ARCHITECTURE_FILE" ]; then
        error "Architecture file not found: $ARCHITECTURE_FILE"
        exit 1
    fi
    
    if [ ! -d "$KUSTOMIZE_DIR" ]; then
        error "Kustomize directory not found: $KUSTOMIZE_DIR"
        exit 1
    fi
    
    echo ""
    echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║           CALM-Aware Deployment Validation Gate                  ║${NC}"
    echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Preliminary: Check CALM Hub connectivity
    section "Preliminary Check: CALM Hub Connectivity"
    if ! check_calm_hub; then
        error "Cannot proceed without CALM Hub"
        exit 1
    fi
    echo ""
    
    # Gate 1: Check if pattern exists in CALM Hub
    section "Gate 1: Pattern Registration Check"
    local pattern_name=$(extract_pattern_from_schema "$ARCHITECTURE_FILE")
    if ! check_pattern_in_hub "$pattern_name"; then
        echo ""
        exit 1
    fi
    echo ""
    
    # Gate 2: Validate architecture
    if ! validate_architecture "$ARCHITECTURE_FILE"; then
        echo ""
        exit 1
    fi
    
    # All gates passed
    echo ""
    echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║              ✓ ALL VALIDATION GATES PASSED                        ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    success "✅ Architecture is valid and ready for deployment"
    echo ""
}

# Run main function
main "$@"
