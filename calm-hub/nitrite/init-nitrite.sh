#!/bin/bash

# CalmHub NitriteDB Initialization Script
# This script initializes a NitriteDB instance with the same data as the MongoDB init script
# but using REST API calls to the CalmHub application

set -e

# Configuration
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8080}"
# Base URL used to build document $id values for the name-based API. Must equal
# the server's calm.hub.base-url config property (default http://localhost:8080),
# which is not necessarily the URL this script reaches the hub on.
CALM_HUB_BASE_URL="${CALM_HUB_BASE_URL:-$CALM_HUB_URL}"
CALM_SCHEMA_BASE_PATH="${CALM_SCHEMA_BASE_PATH:-}"
CALM_CONTROLS_BASE_PATH="${CALM_CONTROLS_BASE_PATH:-}"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if CalmHub is running
check_calmhub_status() {
    print_status "Checking if CalmHub is running at $CALM_HUB_URL..."
    if curl -s -f "$CALM_HUB_URL/q/swagger-ui" > /dev/null 2>&1; then
        print_status "CalmHub is running and accessible"
        return 0
    else
        print_error "CalmHub is not accessible at $CALM_HUB_URL"
        print_error "Please ensure CalmHub is running in standalone mode before running this script"
        exit 1
    fi
}

# Function to create namespaces
create_namespaces() {
    print_status "Creating namespaces..."
    
    # Create required namespaces (the API requires both a name and a description)
    for namespace in finos finos.calm finos.traderx workshop finos.fluxnova; do
        print_status "Creating namespace: $namespace"
        local description
        case "$namespace" in
            # Keep in sync with the namespace descriptions in calm-hub/mongo/init-mongo.js
            finos.fluxnova) description="FluxNova BPM example architectures" ;;
            *) description="$namespace namespace" ;;
        esac
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/api/calm/namespaces" \
            -H "$CONTENT_TYPE" \
            -d "{\"name\": \"$namespace\", \"description\": \"$description\"}")
        if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
            print_status "Created namespace $namespace"
        elif [[ "$http_code" == "409" ]]; then
            print_warning "Namespace $namespace already exists, skipping"
        else
            print_warning "Failed to create namespace $namespace (HTTP $http_code)"
        fi
    done
}

# Function to load schemas from a directory (release or draft)
# Usage: load_schemas_from_dir <base_dir> <prefix>
# e.g. load_schemas_from_dir /calm/release release
load_schemas_from_dir() {
    local base_dir="$1"
    local prefix="$2"

    if [[ ! -d "$base_dir" ]]; then
        print_warning "Schema directory not found at $base_dir, skipping $prefix schemas"
        return
    fi

    for ver_dir in "$base_dir"/*/; do
        [[ -d "$ver_dir" ]] || continue
        local ver
        ver=$(basename "$ver_dir")
        local version="${prefix}/${ver}"
        local meta_dir="${ver_dir}meta"

        if [[ ! -d "$meta_dir" ]]; then
            print_warning "No meta directory found for $version, skipping"
            continue
        fi

        print_status "Creating schema version ${version}..."

        # Build the schemas object by merging all *.json files in meta/
        local schemas_json="{}"
        for schema_file in "$meta_dir"/*.json; do
            [[ -f "$schema_file" ]] || continue
            local filename
            filename=$(basename "$schema_file")
            local content
            content=$(cat "$schema_file")
            schemas_json=$(echo "$schemas_json" | jq --arg k "$filename" --argjson v "$content" '. + {($k): $v}')
        done

        local payload
        payload=$(jq -n --arg version "$version" --argjson schemas "$schemas_json" \
            '{"version": $version, "schemas": $schemas}')

        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/calm/schemas" \
            -H "$CONTENT_TYPE" \
            -d "$payload")

        if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
            print_status "Created schema version ${version}"
        elif [[ "$http_code" == "409" ]]; then
            print_warning "Schema version ${version} already exists, skipping"
        else
            print_warning "Failed to create schema version ${version} (HTTP $http_code)"
        fi
    done
}

# Resolve CALM_SCHEMA_BASE_PATH once (falling back to the calm/ dir beside this
# script when unset) so every schema-reading function — create_core_schemas,
# create_standards, create_interfaces — sees the same path.  Without this a bare
# `bash init-nitrite.sh` (no env var) leaves the var empty, which causes those
# functions to build absolute paths from '/' that don't exist and silently
# [WARN]-skip content.  seed-readonly.sh always exports CALM_SCHEMA_BASE_PATH,
# so the Docker build masks the issue; this fix makes the bare run equally safe.
resolve_schema_base_path() {
    if [[ -z "$CALM_SCHEMA_BASE_PATH" ]]; then
        local script_dir
        script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
        CALM_SCHEMA_BASE_PATH=$(realpath "$script_dir/../../calm" 2>/dev/null || echo "")
    fi
}

# Function to create core schemas
create_core_schemas() {
    print_status "Creating core schemas..."

    if [[ -z "$CALM_SCHEMA_BASE_PATH" || ! -d "$CALM_SCHEMA_BASE_PATH" ]]; then
        print_error "CALM schema base path not found. Set CALM_SCHEMA_BASE_PATH to the calm/ directory."
        return 1
    fi

    print_status "Loading schemas from: $CALM_SCHEMA_BASE_PATH"
    load_schemas_from_dir "${CALM_SCHEMA_BASE_PATH}/release" "release"
    load_schemas_from_dir "${CALM_SCHEMA_BASE_PATH}/draft" "draft"
}

# Function to POST a CALM document using the request envelope expected by the API.
# The API stores the CALM document as a stringified JSON field
# (patternJson / flowJson / architectureJson) alongside a name and description.
# Usage: post_document <namespace> <resource> <json-field> <name> <description> <document-json>
post_document() {
    local namespace="$1"
    local resource="$2"
    local field="$3"
    local name="$4"
    local description="$5"
    local doc="$6"

    local payload
    payload=$(jq -n \
        --arg name "$name" \
        --arg description "$description" \
        --arg field "$field" \
        --argjson doc "$doc" \
        '{name: $name, description: $description} + {($field): ($doc | tojson)}')

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/api/calm/namespaces/$namespace/$resource" \
        -H "$CONTENT_TYPE" \
        -d "$payload")

    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
        print_status "Created $resource '$name' in namespace $namespace"
    elif [[ "$http_code" == "409" ]]; then
        print_warning "$resource '$name' in namespace $namespace already exists, skipping"
    else
        print_warning "Failed to create $resource '$name' in namespace $namespace (HTTP $http_code)"
    fi
}

# post_named_document <namespace> <type-plural> <slug> <version> <document-json>
# Seeds a document through the name-based API (/calm/...), which creates the
# resource_mappings slug entry as well as the document itself (the numeric-ID
# API creates no mapping). The document's $id is rewritten to the canonical hub
# URL the server requires and is stripped again before persistence; the stored
# name/description come from the document's title/description fields. Failures
# are fatal: a systematic $id mismatch would otherwise bake a read-only image
# with an empty namespace.
post_named_document() {
    local namespace="$1"
    local resource="$2"
    local slug="$3"
    local version="$4"
    local doc="$5"

    local canonical="${CALM_HUB_BASE_URL}/calm/namespaces/${namespace}/${resource}/${slug}/versions/${version}"
    local payload
    payload=$(printf '%s' "$doc" | jq --arg id "$canonical" '. + {"$id": $id}')

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$CALM_HUB_URL/calm/namespaces/$namespace/$resource/$slug/versions/$version" \
        -H "$CONTENT_TYPE" \
        -d "$payload")

    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
        print_status "Created $resource '$slug' version $version in namespace $namespace"
    elif [[ "$http_code" == "409" ]]; then
        print_warning "$resource '$slug' version $version in namespace $namespace already exists, skipping"
    else
        print_error "Failed to create $resource '$slug' version $version in namespace $namespace (HTTP $http_code)"
        print_error "  \$id sent: $canonical"
        exit 1
    fi
}

# Look up the numeric id of a namespace-scoped resource by its name.
# Usage: get_resource_id_by_name <namespace> <resource> <name>
get_resource_id_by_name() {
    local namespace="$1"
    local resource="$2"
    local name="$3"

    curl -s "$CALM_HUB_URL/api/calm/namespaces/$namespace/$resource" -H "$CONTENT_TYPE" \
        | jq -r --arg name "$name" '.values[] | select(.name == $name) | .id' \
        | head -n1
}

# POST an additional version of an existing architecture (mutable version store).
# Usage: post_architecture_version <namespace> <architecture-id> <version> <name> <description> <document-json>
post_architecture_version() {
    local namespace="$1"
    local architecture_id="$2"
    local version="$3"
    local name="$4"
    local description="$5"
    local doc="$6"

    local payload
    payload=$(jq -n \
        --arg name "$name" \
        --arg description "$description" \
        --argjson doc "$doc" \
        '{name: $name, description: $description, architectureJson: ($doc | tojson)}')

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$CALM_HUB_URL/api/calm/namespaces/$namespace/architectures/$architecture_id/versions/$version" \
        -H "$CONTENT_TYPE" \
        -d "$payload")

    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
        print_status "Created architecture '$name' version $version in namespace $namespace"
    elif [[ "$http_code" == "409" ]]; then
        print_warning "Architecture '$name' version $version already exists, skipping"
    else
        print_warning "Failed to create architecture '$name' version $version (HTTP $http_code)"
    fi
}

# POST an additional version of an existing pattern (mutable version store).
# PatternResource.createVersionedPattern requires a {name, description, patternJson}
# envelope — the document JSON must be stringified into patternJson, not sent raw.
# Usage: post_pattern_version <namespace> <pattern-id> <version> <name> <description> <document-json>
post_pattern_version() {
    local namespace="$1"
    local pattern_id="$2"
    local version="$3"
    local name="$4"
    local description="$5"
    local doc="$6"

    local payload
    payload=$(jq -n \
        --arg n "$name" \
        --arg d "$description" \
        --argjson doc "$doc" \
        '{name: $n, description: $d, patternJson: ($doc | tojson)}')

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$CALM_HUB_URL/api/calm/namespaces/$namespace/patterns/$pattern_id/versions/$version" \
        -H "$CONTENT_TYPE" \
        -d "$payload")

    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
        print_status "Created pattern '$name' version $version in namespace $namespace"
    elif [[ "$http_code" == "409" ]]; then
        print_warning "Pattern '$name' version $version already exists, skipping"
    else
        print_warning "Failed to create pattern '$name' version $version (HTTP $http_code)"
    fi
}

# Function to create patterns
create_patterns() {
    print_status "Creating patterns..."
    
    # FINOS API Gateway Pattern
    print_status "Creating FINOS API Gateway Pattern..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
            "$id": "https://calm.finos.org/calm/namespaces/finos/patterns/1/versions/1.0.0",
            "title": "API Gateway Pattern",
            "type": "object",
            "properties": {
                "nodes": {
                    "type": "array",
                    "minItems": 4,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "properties": {
                                "well-known-endpoint": {
                                    "type": "string"
                                },
                                "description": {
                                    "const": "The API Gateway used to verify authorization and access to downstream system"
                                },
                                "node-type": {
                                    "const": "system"
                                },
                                "name": {
                                    "const": "API Gateway"
                                },
                                "unique-id": {
                                    "const": "api-gateway"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-gateway-ingress"
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "well-known-endpoint",
                                "interfaces"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "properties": {
                                "description": {
                                    "const": "The API Consumer making an authenticated and authorized request"
                                },
                                "node-type": {
                                    "const": "system"
                                },
                                "name": {
                                    "const": "API Consumer"
                                },
                                "unique-id": {
                                    "const": "api-consumer"
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "properties": {
                                "description": {
                                    "const": "The API Producer serving content"
                                },
                                "node-type": {
                                    "const": "system"
                                },
                                "name": {
                                    "const": "API Producer"
                                },
                                "unique-id": {
                                    "const": "api-producer"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "producer-ingress"
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "interfaces"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "properties": {
                                "description": {
                                    "const": "The Identity Provider used to verify the bearer token"
                                },
                                "node-type": {
                                    "const": "system"
                                },
                                "name": {
                                    "const": "Identity Provider"
                                },
                                "unique-id": {
                                    "const": "idp"
                                }
                            }
                        }
                    ]
                },
                "relationships": {
                    "type": "array",
                    "minItems": 4,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "api-consumer-api-gateway"
                                },
                                "description": {
                                    "const": "Issue calculation request"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "api-consumer"
                                            },
                                            "destination": {
                                                "node": "api-gateway",
                                                "interfaces": [
                                                    "api-gateway-ingress"
                                                ]
                                            }
                                        }
                                    }
                                },
                                "parties": {},
                                "protocol": {
                                    "const": "HTTPS"
                                },
                                "authentication": {
                                    "const": "OAuth2"
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "api-gateway-idp"
                                },
                                "description": {
                                    "const": "Validate bearer token"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "api-gateway"
                                            },
                                            "destination": {
                                                "node": "idp"
                                            }
                                        }
                                    }
                                },
                                "protocol": {
                                    "const": "HTTPS"
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "api-gateway-api-producer"
                                },
                                "description": {
                                    "const": "Forward request"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "api-gateway"
                                            },
                                            "destination": {
                                                "node": "api-producer",
                                                "interfaces": [
                                                    "producer-ingress"
                                                ]
                                            }
                                        }
                                    }
                                },
                                "protocol": {
                                    "const": "HTTPS"
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "api-consumer-idp"
                                },
                                "description": {
                                    "const": "Acquire a bearer token"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "api-consumer"
                                            },
                                            "destination": {
                                                "node": "idp"
                                            }
                                        }
                                    }
                                },
                                "protocol": {
                                    "const": "HTTPS"
                                }
                            }
                        }
                    ]
                }
            },
            "required": [
                "nodes",
                "relationships"
            ]
        }
CALMDOC
)
    post_document "workshop" "patterns" "patternJson" "API Gateway Pattern" "API Gateway pattern for verifying authorization and access to downstream systems" "$doc"

    # Workshop Conference Signup Pattern (Pattern 1) - Exact MongoDB content
    print_status "Creating Workshop Conference Signup Pattern..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0",
            "type": "object",
            "title": "Conference Signup Pattern",
            "description": "A reusable architecture pattern for conference signup systems with Kubernetes deployment.",
            "properties": {
                "nodes": {
                    "type": "array",
                    "minItems": 5,
                    "maxItems": 5,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "conference-website"
                                },
                                "name": {
                                    "const": "Conference Website"
                                },
                                "description": {
                                    "const": "Website to sign up for a conference"
                                },
                                "node-type": {
                                    "const": "webclient"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "maxItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-url"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "load-balancer"
                                },
                                "name": {
                                    "const": "Load Balancer"
                                },
                                "description": {
                                    "const": "The attendees service, or a placeholder for another application"
                                },
                                "node-type": {
                                    "const": "network"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "maxItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-host-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees"
                                },
                                "name": {
                                    "const": "Attendees Service"
                                },
                                "description": {
                                    "const": "The attendees service, or a placeholder for another application"
                                },
                                "node-type": {
                                    "const": "service"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees-store"
                                },
                                "name": {
                                    "const": "Attendees Store"
                                },
                                "description": {
                                    "const": "Persistent storage for attendees"
                                },
                                "node-type": {
                                    "const": "database"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "database-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "database-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "k8s-cluster"
                                },
                                "name": {
                                    "const": "Kubernetes Cluster"
                                },
                                "description": {
                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                },
                                "node-type": {
                                    "const": "system"
                                }
                            }
                        }
                    ]
                },
                "relationships": {
                    "type": "array",
                    "minItems": 4,
                    "maxItems": 4,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "conference-website-load-balancer"
                                },
                                "description": {
                                    "const": "Request attendee details"
                                },
                                "protocol": {
                                    "const": "HTTPS"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "conference-website"
                                            },
                                            "destination": {
                                                "node": "load-balancer"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "load-balancer-attendees-service"
                                },
                                "description": {
                                    "const": "Forward"
                                },
                                "protocol": {
                                    "const": "mTLS"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "load-balancer"
                                            },
                                            "destination": {
                                                "node": "attendees"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees-attendees-store"
                                },
                                "description": {
                                    "const": "Store or request attendee details"
                                },
                                "protocol": {
                                    "const": "JDBC"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "attendees"
                                            },
                                            "destination": {
                                                "node": "attendees-store"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "deployed-in-k8s-cluster"
                                },
                                "description": {
                                    "const": "Components deployed on the k8s cluster"
                                },
                                "relationship-type": {
                                    "const": {
                                        "deployed-in": {
                                            "container": "k8s-cluster",
                                            "nodes": [
                                                "load-balancer",
                                                "attendees",
                                                "attendees-store"
                                            ]
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        }
                    ]
                }
            },
            "required": [
                "nodes",
                "relationships"
            ]
        }
CALMDOC
)
    post_document "workshop" "patterns" "patternJson" "Conference Signup Pattern" "A reusable architecture pattern for conference signup systems with Kubernetes deployment." "$doc"

    # Workshop Conference Signup Pattern - second version (2.0.0)
    # Provides two points-in-time so the calm-hub-ui "Compare" feature has something to diff
    # for patterns. Versus 1.0.0 this adds an attendees cache (node + relationship), tweaks the
    # attendees service description, and extends the Kubernetes deployment to include the cache.
    print_status "Creating Workshop Conference Signup Pattern version 2.0.0..."
    local conf_pattern_id
    conf_pattern_id=$(get_resource_id_by_name "workshop" "patterns" "Conference Signup Pattern")
    local pattern_v2
    pattern_v2=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
            "type": "object",
            "title": "Conference Signup Pattern",
            "description": "A reusable architecture pattern for conference signup systems with Kubernetes deployment.",
            "properties": {
                "nodes": {
                    "type": "array",
                    "minItems": 6,
                    "maxItems": 6,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "conference-website" },
                                "name": { "const": "Conference Website" },
                                "description": { "const": "Website to sign up for a conference" },
                                "node-type": { "const": "webclient" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "load-balancer" },
                                "name": { "const": "Load Balancer" },
                                "description": { "const": "The attendees service, or a placeholder for another application" },
                                "node-type": { "const": "network" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "attendees" },
                                "name": { "const": "Attendees Service" },
                                "description": { "const": "The attendees service with response caching enabled" },
                                "node-type": { "const": "service" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "attendees-store" },
                                "name": { "const": "Attendees Store" },
                                "description": { "const": "Persistent storage for attendees" },
                                "node-type": { "const": "database" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "attendees-cache" },
                                "name": { "const": "Attendees Cache" },
                                "description": { "const": "In-memory cache for attendee lookups" },
                                "node-type": { "const": "database" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "k8s-cluster" },
                                "name": { "const": "Kubernetes Cluster" },
                                "description": { "const": "Kubernetes Cluster with network policy rules enabled" },
                                "node-type": { "const": "system" }
                            }
                        }
                    ]
                },
                "relationships": {
                    "type": "array",
                    "minItems": 5,
                    "maxItems": 5,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "conference-website-load-balancer" },
                                "description": { "const": "Request attendee details" },
                                "protocol": { "const": "HTTPS" },
                                "relationship-type": {
                                    "const": { "connects": { "source": { "node": "conference-website" }, "destination": { "node": "load-balancer" } } }
                                }
                            },
                            "required": [ "description" ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "load-balancer-attendees-service" },
                                "description": { "const": "Forward" },
                                "protocol": { "const": "mTLS" },
                                "relationship-type": {
                                    "const": { "connects": { "source": { "node": "load-balancer" }, "destination": { "node": "attendees" } } }
                                }
                            },
                            "required": [ "description" ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "attendees-attendees-store" },
                                "description": { "const": "Store or request attendee details" },
                                "protocol": { "const": "JDBC" },
                                "relationship-type": {
                                    "const": { "connects": { "source": { "node": "attendees" }, "destination": { "node": "attendees-store" } } }
                                }
                            },
                            "required": [ "description" ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "attendees-attendees-cache" },
                                "description": { "const": "Cache attendee lookups" },
                                "protocol": { "const": "RESP" },
                                "relationship-type": {
                                    "const": { "connects": { "source": { "node": "attendees" }, "destination": { "node": "attendees-cache" } } }
                                }
                            },
                            "required": [ "description" ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": { "const": "deployed-in-k8s-cluster" },
                                "description": { "const": "Components deployed on the k8s cluster" },
                                "relationship-type": {
                                    "const": { "deployed-in": { "container": "k8s-cluster", "nodes": [ "load-balancer", "attendees", "attendees-store", "attendees-cache" ] } }
                                }
                            },
                            "required": [ "description" ]
                        }
                    ]
                }
            },
            "required": [
                "nodes",
                "relationships"
            ]
        }
CALMDOC
)
    if [[ -n "$conf_pattern_id" ]]; then
        post_pattern_version "workshop" "$conf_pattern_id" "2.0.0" "Conference Signup Pattern" "A reusable architecture pattern for conference signup systems with Kubernetes deployment (with attendee caching)." "$pattern_v2"
    else
        print_warning "Could not resolve Conference Signup Pattern id; skipping 2.0.0 seed"
    fi

    # Workshop Conference Secure Signup Pattern (Pattern 2) - Exact MongoDB content
    print_status "Creating Workshop Conference Secure Signup Pattern..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/2/versions/1.0.0",
            "type": "object",
            "title": "Conference Secure Signup Pattern",
            "description": "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment.",
            "properties": {
                "nodes": {
                    "type": "array",
                    "minItems": 5,
                    "maxItems": 5,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "conference-website"
                                },
                                "name": {
                                    "const": "Conference Website"
                                },
                                "description": {
                                    "const": "Website to sign up for a conference"
                                },
                                "node-type": {
                                    "const": "webclient"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "maxItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-url"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "load-balancer"
                                },
                                "name": {
                                    "const": "Load Balancer"
                                },
                                "description": {
                                    "const": "The attendees service, or a placeholder for another application"
                                },
                                "node-type": {
                                    "const": "network"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 1,
                                    "maxItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-host-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees"
                                },
                                "name": {
                                    "const": "Attendees Service"
                                },
                                "description": {
                                    "const": "The attendees service, or a placeholder for another application"
                                },
                                "node-type": {
                                    "const": "service"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees-store"
                                },
                                "name": {
                                    "const": "Attendees Store"
                                },
                                "description": {
                                    "const": "Persistent storage for attendees"
                                },
                                "node-type": {
                                    "const": "database"
                                },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "database-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "database-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "k8s-cluster"
                                },
                                "name": {
                                    "const": "Kubernetes Cluster"
                                },
                                "description": {
                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                },
                                "node-type": {
                                    "const": "system"
                                }
                            }
                        }
                    ]
                },
                "relationships": {
                    "type": "array",
                    "minItems": 4,
                    "maxItems": 4,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "conference-website-load-balancer"
                                },
                                "description": {
                                    "const": "Request attendee details"
                                },
                                "protocol": {
                                    "const": "HTTPS"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "conference-website"
                                            },
                                            "destination": {
                                                "node": "load-balancer"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "load-balancer-attendees-service"
                                },
                                "description": {
                                    "const": "Forward"
                                },
                                "protocol": {
                                    "const": "mTLS"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "load-balancer"
                                            },
                                            "destination": {
                                                "node": "attendees"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "const": "attendees-attendees-store"
                                },
                                "description": {
                                    "const": "Store or request attendee details"
                                },
                                "protocol": {
                                    "const": "JDBC"
                                },
                                "relationship-type": {
                                    "const": {
                                        "connects": {
                                            "source": {
                                                "node": "attendees"
                                            },
                                            "destination": {
                                                "node": "attendees-store"
                                            }
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        },
                        {
                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                            "properties": {
                                "unique-id": {
                                    "const": "deployed-in-k8s-cluster"
                                },
                                "description": {
                                    "const": "Components deployed on the k8s cluster"
                                },
                                "relationship-type": {
                                    "const": {
                                        "deployed-in": {
                                            "container": "k8s-cluster",
                                            "nodes": [
                                                "load-balancer",
                                                "attendees",
                                                "attendees-store"
                                            ]
                                        }
                                    }
                                }
                            },
                            "required": [
                                "description"
                            ]
                        }
                    ]
                }
            },
            "required": [
                "nodes",
                "relationships"
            ]
        }
CALMDOC
)
    post_document "workshop" "patterns" "patternJson" "Conference Secure Signup Pattern" "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment." "$doc"
}

# Function to create flows
create_flows() {
    print_status "Creating flows..."
    
    # TraderX Flow 1 - Add or Update Account
    print_status "Creating TraderX flow 1..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/release/1.2/meta/flow.json",
            "$id": "https://calm.finos.org/traderx/flows/add-update-account.json",
            "unique-id": "flow-add-update-account",
            "name": "Add or Update Account",
            "description": "Flow for adding or updating account information in the database.",
            "transitions": [
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 1,
                    "description": "Submit Account Create/Update"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 2,
                    "description": "inserts or updates account"
                },
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 3,
                    "description": "Returns Account Create/Update Response Status",
                    "direction": "destination-to-source"
                }
            ],
            "controls": {
                "add-update-account-sla": {
                    "description": "Control requirement for flow SLA",
                    "requirements": [
                        {
                            "control-requirement-url": "https://calm.finos.org/samples/traderx/controls/flow-sla-control-requirement.json",
                            "control-config": "https://calm.finos.org/samples/traderx/flows/add-update-account/add-update-account-control-configuration.json"
                        }
                    ]
                }
            }
        }
CALMDOC
)
    post_document "finos.traderx" "flows" "flowJson" "Add or Update Account" "Flow for adding or updating account information in the database." "$doc"

    # TraderX Flow 2 - Load List of Accounts
    print_status "Creating TraderX flow 2..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/release/1.2/meta/flow.json",
            "$id": "https://calm.finos.org/samples/traderx/flows/load-list-of-accounts.json",
            "unique-id": "flow-load-list-of-accounts",
            "name": "Load List of Accounts",
            "description": "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection.",
            "transitions": [
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 1,
                    "description": "Load list of accounts"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 2,
                    "description": "Query for all Accounts"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 3,
                    "description": "Returns list of accounts",
                    "direction": "destination-to-source"
                },
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 4,
                    "description": "Returns list of accounts",
                    "direction": "destination-to-source"
                }
            ]
        }
CALMDOC
)
    post_document "finos.traderx" "flows" "flowJson" "Load List of Accounts" "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection." "$doc"
}

# Function to create architectures
create_architectures() {
    print_status "Creating architectures..."
    
    # Workshop Architecture
    print_status "Creating Workshop architecture..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "nodes": [
                {
                    "unique-id": "conference-website",
                    "name": "Conference Website",
                    "description": "Website to sign up for a conference",
                    "node-type": "webclient",
                    "interfaces": [
                        {
                            "unique-id": "conference-website-url",
                            "url": "[[ URL ]]"
                        }
                    ]
                },
                {
                    "unique-id": "load-balancer",
                    "name": "Load Balancer",
                    "description": "The attendees service, or a placeholder for another application",
                    "node-type": "network",
                    "interfaces": [
                        {
                            "unique-id": "load-balancer-host-port",
                            "host": "[[ HOST ]]",
                            "port": -1
                        }
                    ]
                },
                {
                    "unique-id": "attendees",
                    "name": "Attendees Service",
                    "description": "The attendees service, or a placeholder for another application",
                    "node-type": "service",
                    "interfaces": [
                        {
                            "unique-id": "attendees-image",
                            "image": "[[ IMAGE ]]"
                        },
                        {
                            "unique-id": "attendees-port",
                            "port": -1
                        }
                    ]
                },
                {
                    "unique-id": "attendees-store",
                    "name": "Attendees Store",
                    "description": "Persistent storage for attendees",
                    "node-type": "database",
                    "interfaces": [
                        {
                            "unique-id": "database-image",
                            "image": "[[ IMAGE ]]"
                        },
                        {
                            "unique-id": "database-port",
                            "port": -1
                        }
                    ]
                },
                {
                    "unique-id": "k8s-cluster",
                    "name": "Kubernetes Cluster",
                    "description": "Kubernetes Cluster with network policy rules enabled",
                    "node-type": "system"
                }
            ],
            "relationships": [
                {
                    "unique-id": "conference-website-load-balancer",
                    "description": "Request attendee details",
                    "protocol": "HTTPS",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "conference-website"
                            },
                            "destination": {
                                "node": "load-balancer"
                            }
                        }
                    }
                },
                {
                    "unique-id": "load-balancer-attendees-service",
                    "description": "Forward",
                    "protocol": "mTLS",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "load-balancer"
                            },
                            "destination": {
                                "node": "attendees"
                            }
                        }
                    }
                },
                {
                    "unique-id": "attendees-attendees-store",
                    "description": "Store or request attendee details",
                    "protocol": "JDBC",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "attendees"
                            },
                            "destination": {
                                "node": "attendees-store"
                            }
                        }
                    }
                },
                {
                    "unique-id": "deployed-in-k8s-cluster",
                    "description": "Components deployed on the k8s cluster",
                    "relationship-type": {
                        "deployed-in": {
                            "container": "k8s-cluster",
                            "nodes": [
                                "load-balancer",
                                "attendees",
                                "attendees-store"
                            ]
                        }
                    }
                }
            ],
            "metadata": [
                {
                    "kubernetes": {
                        "namespace": "conference"
                    }
                }
            ],
            "$schema": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0"
        }
CALMDOC
)
    post_document "workshop" "architectures" "architectureJson" "Conference Signup Architecture" "Conference signup system architecture deployed on a Kubernetes cluster" "$doc"

    # Workshop Architecture - second version (2.0.0)
    # Provides two points-in-time so the calm-hub-ui "Compare" feature has something to diff.
    # Versus 1.0.0 this adds an attendees cache (node + relationship), tweaks the attendees
    # service description, and extends the Kubernetes deployment to include the cache.
    print_status "Creating Workshop architecture version 2.0.0..."
    local conf_arch_id
    conf_arch_id=$(get_resource_id_by_name "workshop" "architectures" "Conference Signup Architecture")
    local doc_v2
    doc_v2=$(cat <<'CALMDOC'
{
            "nodes": [
                {
                    "unique-id": "conference-website",
                    "name": "Conference Website",
                    "description": "Website to sign up for a conference",
                    "node-type": "webclient",
                    "interfaces": [{ "unique-id": "conference-website-url", "url": "[[ URL ]]" }]
                },
                {
                    "unique-id": "load-balancer",
                    "name": "Load Balancer",
                    "description": "The attendees service, or a placeholder for another application",
                    "node-type": "network",
                    "interfaces": [{ "unique-id": "load-balancer-host-port", "host": "[[ HOST ]]", "port": -1 }]
                },
                {
                    "unique-id": "attendees",
                    "name": "Attendees Service",
                    "description": "The attendees service with response caching enabled",
                    "node-type": "service",
                    "interfaces": [
                        { "unique-id": "attendees-image", "image": "[[ IMAGE ]]" },
                        { "unique-id": "attendees-port", "port": -1 }
                    ]
                },
                {
                    "unique-id": "attendees-store",
                    "name": "Attendees Store",
                    "description": "Persistent storage for attendees",
                    "node-type": "database",
                    "interfaces": [
                        { "unique-id": "database-image", "image": "[[ IMAGE ]]" },
                        { "unique-id": "database-port", "port": -1 }
                    ]
                },
                {
                    "unique-id": "attendees-cache",
                    "name": "Attendees Cache",
                    "description": "In-memory cache for attendee lookups",
                    "node-type": "database",
                    "interfaces": [
                        { "unique-id": "cache-image", "image": "[[ IMAGE ]]" },
                        { "unique-id": "cache-port", "port": -1 }
                    ]
                },
                {
                    "unique-id": "k8s-cluster",
                    "name": "Kubernetes Cluster",
                    "description": "Kubernetes Cluster with network policy rules enabled",
                    "node-type": "system"
                }
            ],
            "relationships": [
                {
                    "unique-id": "conference-website-load-balancer",
                    "description": "Request attendee details",
                    "protocol": "HTTPS",
                    "relationship-type": { "connects": { "source": { "node": "conference-website" }, "destination": { "node": "load-balancer" } } }
                },
                {
                    "unique-id": "load-balancer-attendees-service",
                    "description": "Forward",
                    "protocol": "mTLS",
                    "relationship-type": { "connects": { "source": { "node": "load-balancer" }, "destination": { "node": "attendees" } } }
                },
                {
                    "unique-id": "attendees-attendees-store",
                    "description": "Store or request attendee details",
                    "protocol": "JDBC",
                    "relationship-type": { "connects": { "source": { "node": "attendees" }, "destination": { "node": "attendees-store" } } }
                },
                {
                    "unique-id": "attendees-attendees-cache",
                    "description": "Cache attendee lookups",
                    "protocol": "RESP",
                    "relationship-type": { "connects": { "source": { "node": "attendees" }, "destination": { "node": "attendees-cache" } } }
                },
                {
                    "unique-id": "deployed-in-k8s-cluster",
                    "description": "Components deployed on the k8s cluster",
                    "relationship-type": { "deployed-in": { "container": "k8s-cluster", "nodes": ["load-balancer", "attendees", "attendees-store", "attendees-cache"] } }
                }
            ],
            "metadata": [{ "kubernetes": { "namespace": "conference" } }],
            "$schema": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0"
        }
CALMDOC
)
    if [[ -n "$conf_arch_id" ]]; then
        post_architecture_version "workshop" "$conf_arch_id" "2.0.0" "Conference Signup Architecture" "Conference signup system architecture deployed on a Kubernetes cluster (with attendee caching)" "$doc_v2"
    else
        print_warning "Could not resolve Conference Signup Architecture id; skipping 2.0.0 seed"
    fi

    # TraderX Architecture
    print_status "Creating TraderX architecture..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
            "nodes": [
                {
                    "unique-id": "traderx-system",
                    "node-type": "system",
                    "name": "TraderX",
                    "description": "Simple Trading System"
                },
                {
                    "unique-id": "traderx-trader",
                    "node-type": "actor",
                    "name": "Trader",
                    "description": "Person who manages accounts and executes trades"
                },
                {
                    "unique-id": "web-client",
                    "node-type": "webclient",
                    "name": "Web Client",
                    "description": "Browser based web interface for TraderX",
                    "data-classification": "Confidential",
                    "run-as": "user"
                },
                {
                    "unique-id": "web-gui-process",
                    "node-type": "service",
                    "name": "Web GUI",
                    "description": "Allows employees to manage accounts and book trades",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "position-service",
                    "node-type": "service",
                    "name": "Position Service",
                    "description": "Server process which processes trading activity and updates positions",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "traderx-db",
                    "node-type": "database",
                    "name": "TraderX DB",
                    "description": "Database which stores account, trade and position state",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "internal-bank-network",
                    "node-type": "network",
                    "name": "Bank ABC Internal Network",
                    "description": "Internal network for Bank ABC",
                    "instance": "Internal Network"
                },
                {
                    "unique-id": "reference-data-service",
                    "node-type": "service",
                    "name": "Reference Data Service",
                    "description": "Service which provides reference data",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "trading-services",
                    "node-type": "service",
                    "name": "Trading Services",
                    "description": "Service which provides trading services",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "trade-feed",
                    "node-type": "service",
                    "name": "Trade Feed",
                    "description": "Message bus for streaming updates to trades and positions",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "trade-processor",
                    "node-type": "service",
                    "name": "Trade Processor",
                    "description": "Process incoming trade requests, settle and persist",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "accounts-service",
                    "node-type": "service",
                    "name": "Accounts Service",
                    "description": "Service which provides account management",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "people-service",
                    "node-type": "service",
                    "name": "People Service",
                    "description": "Service which provides user details management",
                    "data-classification": "Confidential",
                    "run-as": "systemId"
                },
                {
                    "unique-id": "user-directory",
                    "node-type": "ldap",
                    "name": "User Directory",
                    "description": "Golden source of user data",
                    "data-classification": "PII",
                    "run-as": "systemId"
                }
            ],
            "relationships": [
                {
                    "unique-id": "trader-executes-trades",
                    "description": "Executes Trades",
                    "relationship-type": {
                        "interacts": {
                            "actor": "traderx-trader",
                            "nodes": [
                                "web-client"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "trader-manages-accounts",
                    "description": "Manage Accounts",
                    "relationship-type": {
                        "interacts": {
                            "actor": "traderx-trader",
                            "nodes": [
                                "web-client"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "trader-views-trade-status",
                    "description": "View Trade Status / Positions",
                    "relationship-type": {
                        "interacts": {
                            "actor": "traderx-trader",
                            "nodes": [
                                "web-client"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "web-client-uses-web-gui",
                    "description": "Web client interacts with the Web GUI process.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-client"
                            },
                            "destination": {
                                "node": "web-gui-process"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "web-gui-uses-position-service-for-position-queries",
                    "description": "Load positions for account.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "position-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "web-gui-uses-position-service-for-trade-queries",
                    "description": "Load trades for account.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "position-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "position-service-uses-traderx-db-for-positions",
                    "description": "Looks up default positions for a given account.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "position-service"
                            },
                            "destination": {
                                "node": "traderx-db"
                            }
                        }
                    },
                    "protocol": "JDBC"
                },
                {
                    "unique-id": "position-service-uses-traderx-db-for-trades",
                    "description": "Looks up all trades for a given account.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "position-service"
                            },
                            "destination": {
                                "node": "traderx-db"
                            }
                        }
                    },
                    "protocol": "JDBC"
                },
                {
                    "unique-id": "traderx-system-is-deployed-in-internal-bank-network",
                    "relationship-type": {
                        "deployed-in": {
                            "container": "internal-bank-network",
                            "nodes": [
                                "traderx-system"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "traderx-system-is-composed-of",
                    "relationship-type": {
                        "composed-of": {
                            "container": "traderx-system",
                            "nodes": [
                                "web-client",
                                "web-gui-process",
                                "position-service",
                                "traderx-db",
                                "people-service",
                                "reference-data-service",
                                "trading-services",
                                "trade-feed",
                                "trade-processor",
                                "accounts-service"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "traderx-system-components-are-deployed-in-internal-bank-network",
                    "relationship-type": {
                        "deployed-in": {
                            "container": "internal-bank-network",
                            "nodes": [
                                "web-client",
                                "web-gui-process",
                                "position-service",
                                "traderx-db",
                                "people-service",
                                "reference-data-service",
                                "trading-services",
                                "trade-feed",
                                "trade-processor",
                                "accounts-service",
                                "user-directory"
                            ]
                        }
                    }
                },
                {
                    "unique-id": "web-gui-process-uses-reference-data-service",
                    "description": "Looks up securities to assist with creating a trade ticket.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "reference-data-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "web-gui-process-uses-trading-services",
                    "description": "Creates new trades and cancels existing trades.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "trading-services"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "web-gui-process-uses-trade-feed",
                    "description": "Subscribes to trade/position updates feed for currently viewed account.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "trade-feed"
                            }
                        }
                    },
                    "protocol": "WebSocket"
                },
                {
                    "unique-id": "trade-processor-connects-to-trade-feed",
                    "description": "Processes incoming trade requests, persist and publish updates.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "trade-processor"
                            },
                            "destination": {
                                "node": "trade-feed"
                            }
                        }
                    },
                    "protocol": "SocketIO"
                },
                {
                    "unique-id": "trade-processor-connects-to-traderx-db",
                    "description": "Looks up current positions when bootstrapping state, persist trade state and position state.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "trade-processor"
                            },
                            "destination": {
                                "node": "traderx-db"
                            }
                        }
                    },
                    "protocol": "JDBC"
                },
                {
                    "unique-id": "web-gui-process-uses-accounts-service",
                    "description": "Creates/Updates accounts. Gets list of accounts.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "accounts-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "web-gui-process-uses-people-service",
                    "description": "Looks up people data based on typeahead from GUI.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "web-gui-process"
                            },
                            "destination": {
                                "node": "people-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "people-service-connects-to-user-directory",
                    "description": "Looks up people data.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "people-service"
                            },
                            "destination": {
                                "node": "user-directory"
                            }
                        }
                    },
                    "protocol": "LDAP"
                },
                {
                    "unique-id": "trading-services-connects-to-reference-data-service",
                    "description": "Validates securities when creating trades.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "trading-services"
                            },
                            "destination": {
                                "node": "reference-data-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "trading-services-uses-trade-feed",
                    "description": "Publishes updates to trades and positions after persisting in the DB.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "trading-services"
                            },
                            "destination": {
                                "node": "trade-feed"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "trading-services-uses-account-service",
                    "description": "Validates accounts when creating trades.",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "trading-services"
                            },
                            "destination": {
                                "node": "accounts-service"
                            }
                        }
                    },
                    "protocol": "HTTPS"
                },
                {
                    "unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "description": "CRUD operations on account",
                    "relationship-type": {
                        "connects": {
                            "source": {
                                "node": "accounts-service"
                            },
                            "destination": {
                                "node": "traderx-db"
                            }
                        }
                    },
                    "protocol": "JDBC"
                }
            ]
        }
CALMDOC
)
    post_document "finos.traderx" "architectures" "architectureJson" "TraderX Architecture" "TraderX simple trading system architecture" "$doc"

    # FluxNova architectures
    # Source of truth: examples/fluxnova/*.architecture.json — keep these heredocs in sync
    # with those files (and with the equivalent inserts in calm-hub/mongo/init-mongo.js).
    # Seeded via the name-based API so each architecture gets a stable slug mapping.

    print_status "Creating FluxNova: Platform architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-platform.architecture.json",
  "title": "FluxNova: Platform",
  "description": "Base FluxNova BPM platform deployment topology with engine, web apps, REST API, and process database",
  "nodes": [
    {
      "unique-id": "fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment comprising engine, web applications, REST API, and process database"
    },
    {
      "unique-id": "fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 process execution engine responsible for orchestrating workflows, managing process state, and executing service tasks",
      "controls": {
        "audit-logging": {
          "description": "All process execution events, variable changes, and task assignments are recorded in an immutable audit log",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All process execution events, variable changes, and task assignments are recorded in an immutable audit log",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer providing 200+ endpoints for process deployment, task management, variable access, and external system integration (OpenAPI documented)",
      "interfaces": [
        {
          "unique-id": "rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring and operations dashboard providing real-time visibility into running process instances, incidents, and batch operations",
      "interfaces": [
        {
          "unique-id": "cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for user, group, and tenant administration, authorization configuration, and system settings",
      "interfaces": [
        {
          "unique-id": "admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Task assignment and lifecycle management UI enabling human task claiming, completion, and delegation within BPMN workflows",
      "interfaces": [
        {
          "unique-id": "tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing process definitions, runtime state, history, job executor data, and audit logs",
      "interfaces": [
        {
          "unique-id": "process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fluxnova-engine"
          },
          "destination": {
            "node": "fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists process state, history, and audit data to the process database",
      "controls": {
        "encryption-in-transit": {
          "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fluxnova-rest-api"
          },
          "destination": {
            "node": "fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fluxnova-cockpit"
          },
          "destination": {
            "node": "fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries process instances, incidents, and deployments via the REST API"
    },
    {
      "unique-id": "admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fluxnova-admin"
          },
          "destination": {
            "node": "fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages users, groups, authorizations, and system configuration via the REST API"
    },
    {
      "unique-id": "tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fluxnova-tasklist"
          },
          "destination": {
            "node": "fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist retrieves and completes human tasks via the REST API"
    },
    {
      "unique-id": "platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "fluxnova-platform",
          "nodes": [
            "fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-platform" "1.0.0" "$doc"

    print_status "Creating FluxNova: Microservices Orchestration architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-microservices.architecture.json",
  "title": "FluxNova: Microservices Orchestration",
  "description": "FluxNova BPM orchestrating microservices via the external task worker pattern — payment, notification, and fraud-check workers with an async event bus and API gateway",
  "nodes": [
    {
      "unique-id": "ms-fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment hosting the microservices orchestration process"
    },
    {
      "unique-id": "ms-fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating microservice workers via the external task pattern — coordinates payment, notification, and fraud-check service tasks",
      "controls": {
        "audit-logging": {
          "description": "All worker task assignments, completions, and failures are recorded in an immutable audit log for payment traceability",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All worker task assignments, completions, and failures are recorded in an immutable audit log for payment traceability",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "ms-fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer providing external task fetch-and-lock, complete, and failure endpoints for worker microservices",
      "interfaces": [
        {
          "unique-id": "ms-rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "ms-fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring dashboard for payment process instances, worker throughput, queue depths, and failed tasks",
      "interfaces": [
        {
          "unique-id": "ms-cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "ms-fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for worker registration, user administration, and payment platform configuration",
      "interfaces": [
        {
          "unique-id": "ms-admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "ms-fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Human task UI for payment exception handling, fraud review escalations, and manual approval workflows",
      "interfaces": [
        {
          "unique-id": "ms-tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "ms-fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing payment process definitions, runtime state, external task queues, and audit logs",
      "interfaces": [
        {
          "unique-id": "ms-process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    },
    {
      "unique-id": "ms-payment-worker",
      "node-type": "fluxnova:external-task-worker",
      "name": "Payment Worker",
      "description": "External task worker microservice that processes payment transaction tasks — polls the FluxNova engine for tasks, executes payment settlement, and reports completion",
      "interfaces": [
        {
          "unique-id": "ms-payment-worker-endpoint",
          "type": "url",
          "value": "https://payment-worker.internal/health"
        }
      ]
    },
    {
      "unique-id": "ms-notification-worker",
      "node-type": "fluxnova:external-task-worker",
      "name": "Notification Worker",
      "description": "External task worker microservice that handles notification delivery tasks — sends SMS, email, and push notifications based on process variables",
      "interfaces": [
        {
          "unique-id": "ms-notification-worker-endpoint",
          "type": "url",
          "value": "https://notification-worker.internal/health"
        }
      ]
    },
    {
      "unique-id": "ms-fraud-check-worker",
      "node-type": "fluxnova:external-task-worker",
      "name": "Fraud Check Worker",
      "description": "External task worker microservice that executes fraud detection tasks — scores transactions via ML models, returns risk scores to the process engine",
      "interfaces": [
        {
          "unique-id": "ms-fraud-check-worker-endpoint",
          "type": "url",
          "value": "https://fraud-check-worker.internal/health"
        }
      ]
    },
    {
      "unique-id": "ms-message-broker",
      "node-type": "service",
      "name": "Message Broker",
      "description": "Async event bus for worker-to-worker communication and domain event publishing — decouples workers from direct coupling and enables event-driven scaling",
      "interfaces": [
        {
          "unique-id": "ms-message-broker-endpoint",
          "type": "host-port",
          "value": "message-broker:5672"
        }
      ]
    },
    {
      "unique-id": "ms-api-gateway",
      "node-type": "service",
      "name": "API Gateway",
      "description": "Entry point gateway for external API consumers — handles authentication, rate limiting, TLS termination, and request routing to the FluxNova REST API",
      "controls": {
        "encryption-in-transit": {
          "description": "All external client connections terminate TLS at the API gateway — internal traffic uses mTLS on the service mesh",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "All external client connections terminate TLS at the API gateway — internal traffic uses mTLS on the service mesh",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#api-gateway"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "ms-api-gateway-endpoint",
          "type": "url",
          "value": "https://api-gateway.internal/v1"
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "ms-engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fluxnova-engine"
          },
          "destination": {
            "node": "ms-fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists payment process state, external task queues, and audit data to the process database"
    },
    {
      "unique-id": "ms-rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fluxnova-rest-api"
          },
          "destination": {
            "node": "ms-fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "ms-cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fluxnova-cockpit"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries payment process instances and worker metrics via the REST API"
    },
    {
      "unique-id": "ms-admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fluxnova-admin"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages worker registration, users, and payment platform configuration via the REST API"
    },
    {
      "unique-id": "ms-tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fluxnova-tasklist"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist retrieves and completes human escalation and exception tasks via the REST API"
    },
    {
      "unique-id": "ms-platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "ms-platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "ms-platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "ms-platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "ms-platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "ms-platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "ms-fluxnova-platform",
          "nodes": [
            "ms-fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    },
    {
      "unique-id": "ms-payment-worker-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-payment-worker"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Payment worker polls FluxNova REST API for external tasks, locks them for execution, and submits completion or failure results"
    },
    {
      "unique-id": "ms-notification-worker-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-notification-worker"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Notification worker polls FluxNova REST API for notification tasks, executes delivery, and reports back"
    },
    {
      "unique-id": "ms-fraud-check-worker-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-fraud-check-worker"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Fraud check worker polls FluxNova REST API for fraud scoring tasks, runs ML inference, and reports risk scores"
    },
    {
      "unique-id": "ms-payment-worker-to-broker",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-payment-worker"
          },
          "destination": {
            "node": "ms-message-broker"
          }
        }
      },
      "protocol": "AMQP",
      "description": "Payment worker publishes domain events (payment-completed, payment-failed) to the message broker for downstream consumption"
    },
    {
      "unique-id": "ms-notification-worker-to-broker",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-notification-worker"
          },
          "destination": {
            "node": "ms-message-broker"
          }
        }
      },
      "protocol": "AMQP",
      "description": "Notification worker subscribes to payment events from the message broker to trigger customer notifications asynchronously"
    },
    {
      "unique-id": "ms-api-gateway-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ms-api-gateway"
          },
          "destination": {
            "node": "ms-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "API gateway proxies authenticated external requests to the FluxNova REST API after TLS termination and rate-limit checks"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-microservices" "1.0.0" "$doc"

    print_status "Creating FluxNova: KYC Onboarding architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-kyc-onboarding.architecture.json",
  "title": "FluxNova: KYC Onboarding",
  "description": "Pre-trade KYC onboarding architecture with identity verification, sanctions screening, risk scoring, and compliance review built on FluxNova BPM platform",
  "nodes": [
    {
      "unique-id": "kyc-fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment hosting the KYC onboarding process"
    },
    {
      "unique-id": "kyc-fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 engine executing the Client Onboarding KYC process (Process_ClientOnboardingKYC) with boundary timers, escalation gateways, and DMN risk scoring",
      "controls": {
        "audit-logging": {
          "description": "All process execution events, variable changes, task assignments, and decision outcomes are recorded in an immutable audit log for regulatory compliance",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All process execution events, variable changes, task assignments, and decision outcomes are recorded in an immutable audit log for regulatory compliance",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer providing endpoints for KYC process deployment, task management, and external task worker integration",
      "interfaces": [
        {
          "unique-id": "kyc-rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "kyc-fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring dashboard for KYC onboarding — tracks in-flight applications, SLA breaches, and escalation incidents",
      "interfaces": [
        {
          "unique-id": "kyc-cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "kyc-fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for KYC user roles, group assignments, and authorization policies",
      "interfaces": [
        {
          "unique-id": "kyc-admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "kyc-fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Task UI for compliance officers and operations staff to claim and complete KYC review tasks, remediation tasks, and enhanced due diligence assessments",
      "interfaces": [
        {
          "unique-id": "kyc-tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "kyc-fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing KYC process definitions, runtime state, decision audit history, and escalation records",
      "interfaces": [
        {
          "unique-id": "kyc-process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    },
    {
      "unique-id": "kyc-customer",
      "node-type": "actor",
      "name": "Customer",
      "description": "Prospective client submitting a KYC onboarding application, providing identity documents, proof of address, and corporate documentation"
    },
    {
      "unique-id": "kyc-compliance-officer",
      "node-type": "actor",
      "name": "Compliance Officer",
      "description": "Reviews medium-risk KYC applications, conducts compliance investigations on sanctions matches, and makes approval/rejection decisions"
    },
    {
      "unique-id": "kyc-senior-compliance",
      "node-type": "actor",
      "name": "Senior Compliance Officer",
      "description": "Conducts enhanced due diligence for high-risk KYC applications and handles escalated compliance decisions"
    },
    {
      "unique-id": "kyc-ops-manager",
      "node-type": "actor",
      "name": "Operations Manager",
      "description": "Receives escalations when document verification SLA (48 hours) is breached and manages operational remediation"
    },
    {
      "unique-id": "kyc-identity-verification-svc",
      "node-type": "service",
      "name": "Identity Verification Service",
      "description": "External task worker performing OCR, biometric verification, and identity document validation via third-party IDV provider (topic: doc-verification)",
      "interfaces": [
        {
          "unique-id": "kyc-idv-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/verify"
        }
      ],
      "data-classification": "PII",
      "controls": {
        "data-classification": {
          "description": "Processes personally identifiable information including identity documents, biometric data, and government IDs — classified as PII",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-data-classification",
                "name": "Data Classification",
                "description": "Processes personally identifiable information including identity documents, biometric data, and government IDs — classified as PII",
                "reference-url": "https://calm.finos.org/core-concepts/data-classification"
              }
            }
          ]
        },
        "audit-logging": {
          "description": "All verification requests, results, and third-party API calls are logged for regulatory audit trail",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All verification requests, results, and third-party API calls are logged for regulatory audit trail",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-sanctions-screening-svc",
      "node-type": "service",
      "name": "Sanctions & PEP Screening Service",
      "description": "External task worker querying OFAC, UN, EU sanctions lists and PEP databases for compliance checks (topic: sanctions-screen)",
      "interfaces": [
        {
          "unique-id": "kyc-sanctions-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/sanctions"
        }
      ],
      "controls": {
        "audit-logging": {
          "description": "All sanctions and PEP screening queries, match results, and investigation outcomes are logged for regulatory compliance",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All sanctions and PEP screening queries, match results, and investigation outcomes are logged for regulatory compliance",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-risk-scoring-svc",
      "node-type": "service",
      "name": "AML/KYC Risk Scoring Service",
      "description": "DMN decision table evaluating client type, jurisdiction, transaction profile, PEP status, sanctions results, and beneficial ownership to produce a risk category (Low/Medium/High)",
      "interfaces": [
        {
          "unique-id": "kyc-risk-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/risk-assessment"
        }
      ],
      "controls": {
        "audit-logging": {
          "description": "All risk scoring inputs, decision table evaluations, and output categories are logged with full decision rationale",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All risk scoring inputs, decision table evaluations, and output categories are logged with full decision rationale",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-document-mgmt-svc",
      "node-type": "service",
      "name": "Document Management Service",
      "description": "External task worker handling secure storage and retrieval of identity documents, proof of address, and corporate documentation (topic: document-management)",
      "interfaces": [
        {
          "unique-id": "kyc-docmgmt-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/documents"
        }
      ],
      "data-classification": "PII",
      "controls": {
        "data-classification": {
          "description": "Stores and manages personally identifiable documents including passports, driving licenses, and proof of address — classified as PII",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-data-classification",
                "name": "Data Classification",
                "description": "Stores and manages personally identifiable documents including passports, driving licenses, and proof of address — classified as PII",
                "reference-url": "https://calm.finos.org/core-concepts/data-classification"
              }
            }
          ]
        },
        "encryption-at-rest": {
          "description": "All stored documents are encrypted at rest using AES-256 to protect PII",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-at-rest",
                "name": "Encryption At Rest",
                "description": "All stored documents are encrypted at rest using AES-256 to protect PII",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-notification-svc",
      "node-type": "service",
      "name": "Notification Service",
      "description": "External task worker sending email and push notifications to customers, sales teams, and compliance staff for onboarding status updates (topic: notifications)",
      "interfaces": [
        {
          "unique-id": "kyc-notify-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/notifications"
        }
      ]
    },
    {
      "unique-id": "kyc-crm-sync-svc",
      "node-type": "service",
      "name": "CRM Sync Service",
      "description": "External task worker persisting client data to the CRM and provisioning accounts in trading and custodian systems upon approval (topic: crm-sync, account-provisioning)",
      "interfaces": [
        {
          "unique-id": "kyc-crm-api",
          "type": "url",
          "value": "https://kyc-services.internal/api/v1/crm"
        }
      ]
    },
    {
      "unique-id": "kyc-kyc-database",
      "node-type": "database",
      "name": "KYC Database",
      "description": "Dedicated database storing customer PII, verification results, sanctions screening outcomes, risk assessments, and compliance decisions",
      "interfaces": [
        {
          "unique-id": "kyc-kyc-db-port",
          "type": "host-port",
          "value": "kyc-db:5432"
        }
      ],
      "data-classification": "PII",
      "controls": {
        "data-classification": {
          "description": "Contains personally identifiable information including customer identity data, verification results, and compliance decisions — classified as PII",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-data-classification",
                "name": "Data Classification",
                "description": "Contains personally identifiable information including customer identity data, verification results, and compliance decisions — classified as PII",
                "reference-url": "https://calm.finos.org/core-concepts/data-classification"
              }
            }
          ]
        },
        "encryption-at-rest": {
          "description": "All PII data is encrypted at rest using AES-256 with key management via HSM",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-at-rest",
                "name": "Encryption At Rest",
                "description": "All PII data is encrypted at rest using AES-256 with key management via HSM",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        },
        "access-control": {
          "description": "Database access restricted to authorized KYC services only via role-based access control and network segmentation",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-access-control",
                "name": "Access Control",
                "description": "Database access restricted to authorized KYC services only via role-based access control and network segmentation",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-watchlist-provider",
      "node-type": "system",
      "name": "Watchlist Data Provider",
      "description": "External system providing OFAC, UN, EU sanctions lists and PEP databases for compliance screening"
    },
    {
      "unique-id": "kyc-idv-provider",
      "node-type": "system",
      "name": "Identity Verification Provider",
      "description": "External third-party identity verification provider performing OCR, biometric matching, and document authenticity checks"
    }
  ],
  "relationships": [
    {
      "unique-id": "kyc-engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists KYC process state, history, decision audit data, and escalation records",
      "controls": {
        "encryption-in-transit": {
          "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-rest-api"
          },
          "destination": {
            "node": "kyc-fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "kyc-cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-cockpit"
          },
          "destination": {
            "node": "kyc-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries KYC process instances, SLA breach incidents, and escalation status"
    },
    {
      "unique-id": "kyc-admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-admin"
          },
          "destination": {
            "node": "kyc-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages KYC user roles, compliance group assignments, and authorization policies"
    },
    {
      "unique-id": "kyc-tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-tasklist"
          },
          "destination": {
            "node": "kyc-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist enables compliance officers and ops staff to claim and complete KYC review tasks"
    },
    {
      "unique-id": "kyc-customer-to-tasklist",
      "relationship-type": {
        "interacts": {
          "actor": "kyc-customer",
          "nodes": [
            "kyc-fluxnova-tasklist"
          ]
        }
      },
      "description": "Customer submits onboarding application and uploads identity documents via the client portal"
    },
    {
      "unique-id": "kyc-compliance-officer-to-tasklist",
      "relationship-type": {
        "interacts": {
          "actor": "kyc-compliance-officer",
          "nodes": [
            "kyc-fluxnova-tasklist"
          ]
        }
      },
      "description": "Compliance officer claims and completes medium-risk review tasks, sanctions investigation tasks, and approval decisions"
    },
    {
      "unique-id": "kyc-senior-compliance-to-tasklist",
      "relationship-type": {
        "interacts": {
          "actor": "kyc-senior-compliance",
          "nodes": [
            "kyc-fluxnova-tasklist"
          ]
        }
      },
      "description": "Senior compliance officer conducts enhanced due diligence tasks for high-risk applications"
    },
    {
      "unique-id": "kyc-ops-manager-to-cockpit",
      "relationship-type": {
        "interacts": {
          "actor": "kyc-ops-manager",
          "nodes": [
            "kyc-fluxnova-cockpit"
          ]
        }
      },
      "description": "Operations manager monitors SLA compliance and receives escalation alerts for document verification delays"
    },
    {
      "unique-id": "kyc-engine-to-idv-svc",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-identity-verification-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches document verification external tasks (ServiceTask_VerifyDocuments) with 48-hour SLA boundary timer",
      "controls": {
        "audit-logging": {
          "description": "All verification task dispatches, completions, and SLA breach escalations are audit-logged",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All verification task dispatches, completions, and SLA breach escalations are audit-logged",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-engine-to-sanctions-svc",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-sanctions-screening-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches sanctions and PEP screening external tasks (ServiceTask_SanctionsPEP) after document verification passes",
      "controls": {
        "audit-logging": {
          "description": "All screening task dispatches, match results, and routing decisions are audit-logged",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All screening task dispatches, match results, and routing decisions are audit-logged",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-engine-to-risk-scoring",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-risk-scoring-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine invokes DMN risk assessment (BusinessRule_RiskAssessment) with 24-hour SLA boundary timer, producing Low/Medium/High risk category",
      "controls": {
        "audit-logging": {
          "description": "All risk scoring inputs, DMN decision table evaluations, and category outputs are audit-logged with full rationale",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All risk scoring inputs, DMN decision table evaluations, and category outputs are audit-logged with full rationale",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-engine-to-doc-mgmt",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-document-mgmt-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches document storage tasks (ServiceTask_StoreDocuments) for uploaded identity documents and corporate documentation",
      "controls": {
        "encryption-in-transit": {
          "description": "PII document transfers use TLS 1.3 encryption in transit",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "PII document transfers use TLS 1.3 encryption in transit",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-engine-to-notification",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-notification-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches notification tasks (ServiceTask_NotifySalesClient) for onboarding status updates and approval/rejection notices"
    },
    {
      "unique-id": "kyc-engine-to-crm-sync",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-fluxnova-engine"
          },
          "destination": {
            "node": "kyc-crm-sync-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches CRM sync tasks (ServiceTask_PersistClientData) and account provisioning tasks (ServiceTask_AccountOpening) for approved clients",
      "controls": {
        "audit-logging": {
          "description": "All client data persistence and account provisioning events are audit-logged",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All client data persistence and account provisioning events are audit-logged",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-idv-svc-to-kyc-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-identity-verification-svc"
          },
          "destination": {
            "node": "kyc-kyc-database"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Persists identity verification results, document metadata, and biometric match scores",
      "controls": {
        "encryption-in-transit": {
          "description": "PII data transfers to database use TLS-encrypted JDBC",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "PII data transfers to database use TLS-encrypted JDBC",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-sanctions-svc-to-kyc-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-sanctions-screening-svc"
          },
          "destination": {
            "node": "kyc-kyc-database"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Persists sanctions screening results, PEP match data, and investigation outcomes",
      "controls": {
        "encryption-in-transit": {
          "description": "Screening result transfers to database use TLS-encrypted JDBC",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "Screening result transfers to database use TLS-encrypted JDBC",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-risk-scoring-to-kyc-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-risk-scoring-svc"
          },
          "destination": {
            "node": "kyc-kyc-database"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Persists risk assessment inputs, DMN decision outputs, and risk category assignments"
    },
    {
      "unique-id": "kyc-doc-mgmt-to-kyc-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-document-mgmt-svc"
          },
          "destination": {
            "node": "kyc-kyc-database"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Persists document metadata, storage references, and verification linkages",
      "controls": {
        "encryption-in-transit": {
          "description": "PII document metadata transfers to database use TLS-encrypted JDBC",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "PII document metadata transfers to database use TLS-encrypted JDBC",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-crm-sync-to-kyc-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-crm-sync-svc"
          },
          "destination": {
            "node": "kyc-kyc-database"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Reads approved client data for CRM synchronization and account provisioning"
    },
    {
      "unique-id": "kyc-idv-svc-to-idv-provider",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-identity-verification-svc"
          },
          "destination": {
            "node": "kyc-idv-provider"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Calls external IDV provider API for OCR, biometric matching, and document authenticity verification",
      "controls": {
        "encryption-in-transit": {
          "description": "External API calls carrying PII use mTLS for mutual authentication and encryption",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "External API calls carrying PII use mTLS for mutual authentication and encryption",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        },
        "audit-logging": {
          "description": "All external IDV API calls and responses are logged for compliance audit trail",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All external IDV API calls and responses are logged for compliance audit trail",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-sanctions-svc-to-watchlist",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "kyc-sanctions-screening-svc"
          },
          "destination": {
            "node": "kyc-watchlist-provider"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Queries OFAC, UN, EU sanctions lists and PEP databases for compliance screening",
      "controls": {
        "encryption-in-transit": {
          "description": "External watchlist API calls use TLS 1.3 encryption for data protection",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "External watchlist API calls use TLS 1.3 encryption for data protection",
                "reference-url": "https://calm.finos.org/core-concepts/controls"
              }
            }
          ]
        },
        "audit-logging": {
          "description": "All sanctions screening queries and results are logged for regulatory compliance",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All sanctions screening queries and results are logged for regulatory compliance",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "kyc-platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "kyc-platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "kyc-platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "kyc-platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "kyc-platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "kyc-platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "kyc-fluxnova-platform",
          "nodes": [
            "kyc-fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-kyc-onboarding" "1.0.0" "$doc"

    print_status "Creating FluxNova: Post-Trade Settlement architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-settlement.architecture.json",
  "title": "FluxNova: Post-Trade Settlement",
  "description": "Post-trade settlement blueprint with counterparty gateway, clearing house connector, regulatory reporting, and settlement database built on FluxNova BPM platform",
  "nodes": [
    {
      "unique-id": "st-fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment hosting the post-trade settlement process"
    },
    {
      "unique-id": "st-fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating trade confirmation, netting, novation, and settlement lifecycle workflows",
      "controls": {
        "audit-logging": {
          "description": "All settlement process events, trade state transitions, and regulatory submissions are recorded in an immutable audit log",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All settlement process events, trade state transitions, and regulatory submissions are recorded in an immutable audit log",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "st-fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer for trade submission, settlement status queries, and external task worker integration",
      "interfaces": [
        {
          "unique-id": "st-rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "st-fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring dashboard providing real-time visibility into settlement process instances, failed trades, and regulatory deadlines",
      "interfaces": [
        {
          "unique-id": "st-cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "st-fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for counterparty onboarding, user administration, and settlement platform configuration",
      "interfaces": [
        {
          "unique-id": "st-admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "st-fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Task management UI for trade exception handling, manual matching, and compliance review tasks in the settlement workflow",
      "interfaces": [
        {
          "unique-id": "st-tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "st-fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing settlement process definitions, runtime state, trade history, and compliance audit logs",
      "interfaces": [
        {
          "unique-id": "st-process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    },
    {
      "unique-id": "st-counterparty-gateway",
      "node-type": "service",
      "name": "Counterparty Gateway",
      "description": "Secure gateway for counterparty trade confirmations and matching via FIX, FpML, and SWIFT message protocols",
      "controls": {
        "encryption-in-transit": {
          "description": "All counterparty communications use mTLS to authenticate both parties and encrypt trade confirmation data",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "All counterparty communications use mTLS to authenticate both parties and encrypt trade confirmation data",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#counterparty-auth"
              }
            }
          ]
        },
        "audit-logging": {
          "description": "All inbound and outbound counterparty messages are logged with timestamps for regulatory audit trails",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All inbound and outbound counterparty messages are logged with timestamps for regulatory audit trails",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "st-counterparty-gateway-endpoint",
          "type": "url",
          "value": "https://counterparty-gateway.internal/confirm"
        }
      ]
    },
    {
      "unique-id": "st-clearing-house-connector",
      "node-type": "service",
      "name": "Clearing House Connector",
      "description": "Connector to central clearing house (CCP) for trade novation, netting, and multilateral settlement instruction submission",
      "controls": {
        "encryption-in-transit": {
          "description": "Clearing house connectivity uses leased line or dedicated VPN with TLS for trade submission integrity",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "Clearing house connectivity uses leased line or dedicated VPN with TLS for trade submission integrity",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#ccp-connectivity"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "st-clearing-house-endpoint",
          "type": "url",
          "value": "https://ccp-connector.internal/submit"
        }
      ]
    },
    {
      "unique-id": "st-regulatory-reporting-svc",
      "node-type": "service",
      "name": "Regulatory Reporting Service",
      "description": "Automated regulatory reporting service generating EMIR, MiFIR, and Dodd-Frank trade reports with real-time submission to trade repositories",
      "controls": {
        "regulatory-compliance": {
          "description": "All trade reports are validated against ESMA and CFTC schemas before submission; submission receipts are archived for 7 years",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-regulatory-compliance",
                "name": "Regulatory Compliance",
                "description": "All trade reports are validated against ESMA and CFTC schemas before submission; submission receipts are archived for 7 years",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/regulatory-reporting"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "st-regulatory-reporting-endpoint",
          "type": "url",
          "value": "https://regulatory-reporting.internal/submit"
        }
      ]
    },
    {
      "unique-id": "st-settlement-db",
      "node-type": "database",
      "name": "Settlement Database",
      "description": "Settlement positions, obligations, and trade lifecycle data store — source of truth for net settlement positions and regulatory reporting",
      "controls": {
        "encryption-in-transit": {
          "description": "All connections to the settlement database use TLS-encrypted JDBC",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "All connections to the settlement database use TLS-encrypted JDBC",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "st-settlement-db-port",
          "type": "host-port",
          "value": "settlement-db:5432"
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "st-engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-engine"
          },
          "destination": {
            "node": "st-fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists settlement process state, history, and audit data to the process database"
    },
    {
      "unique-id": "st-rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-rest-api"
          },
          "destination": {
            "node": "st-fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "st-cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-cockpit"
          },
          "destination": {
            "node": "st-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries settlement process instances and compliance deadlines via the REST API"
    },
    {
      "unique-id": "st-admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-admin"
          },
          "destination": {
            "node": "st-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages counterparty onboarding, users, and platform configuration via the REST API"
    },
    {
      "unique-id": "st-tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-tasklist"
          },
          "destination": {
            "node": "st-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist retrieves and completes trade exception and compliance review tasks via the REST API"
    },
    {
      "unique-id": "st-platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "st-platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "st-platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "st-platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "st-platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "st-platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "st-fluxnova-platform",
          "nodes": [
            "st-fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    },
    {
      "unique-id": "st-engine-to-counterparty-gateway",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-engine"
          },
          "destination": {
            "node": "st-counterparty-gateway"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine invokes the counterparty gateway for trade confirmation matching and settlement instruction exchange"
    },
    {
      "unique-id": "st-engine-to-clearing-house",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-engine"
          },
          "destination": {
            "node": "st-clearing-house-connector"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine submits cleared trades for novation and netting via the clearing house connector"
    },
    {
      "unique-id": "st-engine-to-regulatory-reporting",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-engine"
          },
          "destination": {
            "node": "st-regulatory-reporting-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine triggers regulatory report generation after trade confirmation and settlement instruction creation"
    },
    {
      "unique-id": "st-engine-to-settlement-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-fluxnova-engine"
          },
          "destination": {
            "node": "st-settlement-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine reads and writes settlement positions and obligations to the settlement database during workflow execution"
    },
    {
      "unique-id": "st-regulatory-reporting-to-settlement-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "st-regulatory-reporting-svc"
          },
          "destination": {
            "node": "st-settlement-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Regulatory reporting service reads consolidated settlement positions from the settlement database for report generation"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-settlement" "1.0.0" "$doc"

    print_status "Creating FluxNova: Flash Risk Management architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-flash-risk.architecture.json",
  "title": "FluxNova: Flash Risk Management",
  "description": "Real-time flash risk management blueprint with on-premise and cloud compute, aggregation, and auto-provisioning for latency-sensitive financial risk calculations",
  "nodes": [
    {
      "unique-id": "fr-fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment hosting the flash risk orchestration process"
    },
    {
      "unique-id": "fr-fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating the flash risk calculation workflow, dispatching tasks to on-premise and cloud compute nodes",
      "controls": {
        "audit-logging": {
          "description": "All risk calculation dispatches, results, and exceptions are recorded in an immutable audit log",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All risk calculation dispatches, results, and exceptions are recorded in an immutable audit log",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "fr-fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer providing endpoints for risk process deployment, external task worker integration, and risk result retrieval",
      "interfaces": [
        {
          "unique-id": "fr-rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "fr-fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring dashboard providing real-time visibility into risk calculation instances, incidents, and batch operations",
      "interfaces": [
        {
          "unique-id": "fr-cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "fr-fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for user, group, and tenant administration for the risk management platform",
      "interfaces": [
        {
          "unique-id": "fr-admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "fr-fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Task assignment UI for human review and exception handling in risk calculation workflows",
      "interfaces": [
        {
          "unique-id": "fr-tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "fr-fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing risk process definitions, runtime state, history, and audit logs",
      "interfaces": [
        {
          "unique-id": "fr-process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    },
    {
      "unique-id": "fr-risk-compute-onprem",
      "node-type": "service",
      "name": "On-Premise Risk Engine",
      "description": "On-premise risk computation engine for latency-sensitive calculations requiring sub-millisecond response times and access to co-located market data feeds",
      "data-classification": "Confidential",
      "controls": {
        "data-classification": {
          "description": "Risk computation results are classified Confidential — position data, P&L, and risk factors must not leave the secure perimeter",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-data-classification",
                "name": "Data Classification",
                "description": "Risk computation results are classified Confidential — position data, P&L, and risk factors must not leave the secure perimeter",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/data-classification"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "fr-onprem-compute-endpoint",
          "type": "host-port",
          "value": "risk-compute-onprem:8080"
        }
      ]
    },
    {
      "unique-id": "fr-risk-compute-cloud",
      "node-type": "service",
      "name": "Cloud Risk Engine",
      "description": "Cloud-based risk computation engine for burst capacity scaling during high-volatility market events when on-premise capacity is exhausted",
      "data-classification": "Confidential",
      "controls": {
        "data-classification": {
          "description": "Cloud risk computations handle Confidential position data — encryption in transit and at rest is mandatory",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-data-classification",
                "name": "Data Classification",
                "description": "Cloud risk computations handle Confidential position data — encryption in transit and at rest is mandatory",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/data-classification"
              }
            }
          ]
        },
        "encryption-in-transit": {
          "description": "All position data sent to cloud compute is encrypted in transit using TLS 1.3 minimum",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-encryption-in-transit",
                "name": "Encryption In Transit",
                "description": "All position data sent to cloud compute is encrypted in transit using TLS 1.3 minimum",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#cloud-encryption"
              }
            }
          ]
        }
      },
      "interfaces": [
        {
          "unique-id": "fr-cloud-compute-endpoint",
          "type": "url",
          "value": "https://risk-compute-cloud.internal/compute"
        }
      ]
    },
    {
      "unique-id": "fr-risk-aggregation-svc",
      "node-type": "service",
      "name": "Risk Aggregation Service",
      "description": "Aggregates risk results from on-premise and cloud compute nodes, merges partial risk vectors, and produces consolidated real-time risk reports",
      "interfaces": [
        {
          "unique-id": "fr-aggregation-endpoint",
          "type": "host-port",
          "value": "risk-aggregation-svc:8081"
        }
      ]
    },
    {
      "unique-id": "fr-cloud-provisioner",
      "node-type": "service",
      "name": "Cloud Provisioner",
      "description": "Auto-provisions cloud compute instances based on market volatility signals, scaling out when VIX or realized volatility exceeds configured thresholds",
      "interfaces": [
        {
          "unique-id": "fr-provisioner-endpoint",
          "type": "url",
          "value": "https://cloud-provisioner.internal/provision"
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "fr-engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-engine"
          },
          "destination": {
            "node": "fr-fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists risk process state, history, and audit data to the process database"
    },
    {
      "unique-id": "fr-rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-rest-api"
          },
          "destination": {
            "node": "fr-fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "fr-cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-cockpit"
          },
          "destination": {
            "node": "fr-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries risk process instances and incidents via the REST API"
    },
    {
      "unique-id": "fr-admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-admin"
          },
          "destination": {
            "node": "fr-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages users, authorizations, and risk platform configuration via the REST API"
    },
    {
      "unique-id": "fr-tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-tasklist"
          },
          "destination": {
            "node": "fr-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist retrieves and completes human exception-handling tasks via the REST API"
    },
    {
      "unique-id": "fr-platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "fr-platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "fr-platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "fr-platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "fr-platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "fr-platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "fr-fluxnova-platform",
          "nodes": [
            "fr-fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    },
    {
      "unique-id": "fr-engine-to-onprem-compute",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-engine"
          },
          "destination": {
            "node": "fr-risk-compute-onprem"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches risk calculation tasks to the on-premise compute engine for low-latency position risk calculations"
    },
    {
      "unique-id": "fr-engine-to-cloud-compute",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-engine"
          },
          "destination": {
            "node": "fr-risk-compute-cloud"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches burst risk calculation tasks to the cloud compute engine when on-premise capacity is exceeded"
    },
    {
      "unique-id": "fr-onprem-to-aggregation",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-risk-compute-onprem"
          },
          "destination": {
            "node": "fr-risk-aggregation-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "On-premise compute pushes partial risk vectors to the aggregation service for consolidation"
    },
    {
      "unique-id": "fr-cloud-to-aggregation",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-risk-compute-cloud"
          },
          "destination": {
            "node": "fr-risk-aggregation-svc"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cloud compute pushes burst risk results to the aggregation service for consolidation"
    },
    {
      "unique-id": "fr-provisioner-to-cloud-compute",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-cloud-provisioner"
          },
          "destination": {
            "node": "fr-risk-compute-cloud"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Provisioner scales cloud compute instances up or down based on real-time volatility signals"
    },
    {
      "unique-id": "fr-engine-to-provisioner",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "fr-fluxnova-engine"
          },
          "destination": {
            "node": "fr-cloud-provisioner"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine signals the provisioner to scale cloud capacity when market volatility triggers burst mode"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-flash-risk" "1.0.0" "$doc"

    print_status "Creating FluxNova: AI Agent Orchestration architecture..."
    doc=$(cat <<'CALMDOC'
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-ai-agent.architecture.json",
  "title": "FluxNova: AI Agent Orchestration",
  "description": "FluxNova BPM platform orchestrating autonomous AI agents with LLM inference, guardrails, and callable tools — AIGF governance controls pre-applied",
  "nodes": [
    {
      "unique-id": "ai-fluxnova-platform",
      "node-type": "fluxnova:platform",
      "name": "FluxNova Platform",
      "description": "Full FluxNova BPM platform deployment hosting the AI agent orchestration process"
    },
    {
      "unique-id": "ai-fluxnova-engine",
      "node-type": "fluxnova:engine",
      "name": "FluxNova BPM Engine",
      "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating AI agent task dispatch, monitoring, and human-in-the-loop escalation workflows",
      "controls": {
        "audit-logging": {
          "description": "All AI agent task dispatches, LLM calls, guardrail verdicts, and tool invocations are recorded in an immutable audit log",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-audit-logging",
                "name": "Audit Logging",
                "description": "All AI agent task dispatches, LLM calls, guardrail verdicts, and tool invocations are recorded in an immutable audit log",
                "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "ai-fluxnova-rest-api",
      "node-type": "fluxnova:rest-api",
      "name": "FluxNova REST API",
      "description": "RESTful API layer for AI process deployment, agent task polling, and result submission",
      "interfaces": [
        {
          "unique-id": "ai-rest-api-endpoint",
          "type": "url",
          "value": "https://fluxnova.internal/engine-rest"
        }
      ]
    },
    {
      "unique-id": "ai-fluxnova-cockpit",
      "node-type": "fluxnova:cockpit",
      "name": "FluxNova Cockpit",
      "description": "Process monitoring dashboard for AI agent task instances, LLM latency, guardrail rejection rates, and escalation incidents",
      "interfaces": [
        {
          "unique-id": "ai-cockpit-url",
          "type": "url",
          "value": "https://fluxnova.internal/cockpit"
        }
      ]
    },
    {
      "unique-id": "ai-fluxnova-admin",
      "node-type": "fluxnova:admin",
      "name": "FluxNova Admin",
      "description": "Management console for AI agent configuration, LLM model version management, and guardrail policy administration",
      "interfaces": [
        {
          "unique-id": "ai-admin-url",
          "type": "url",
          "value": "https://fluxnova.internal/admin"
        }
      ]
    },
    {
      "unique-id": "ai-fluxnova-tasklist",
      "node-type": "fluxnova:tasklist",
      "name": "FluxNova Tasklist",
      "description": "Human-in-the-loop task UI for reviewing AI agent decisions, approving high-risk actions, and resolving guardrail rejections",
      "interfaces": [
        {
          "unique-id": "ai-tasklist-url",
          "type": "url",
          "value": "https://fluxnova.internal/tasklist"
        }
      ]
    },
    {
      "unique-id": "ai-fluxnova-process-db",
      "node-type": "fluxnova:process-db",
      "name": "Process Database",
      "description": "Relational database storing AI agent process definitions, runtime state, LLM interaction history, and AIGF audit logs",
      "interfaces": [
        {
          "unique-id": "ai-process-db-port",
          "type": "host-port",
          "value": "process-db:5432"
        }
      ]
    },
    {
      "unique-id": "ai-agent",
      "node-type": "ai:agent",
      "name": "AI Agent",
      "description": "Autonomous AI agent executing tasks assigned by the FluxNova process engine — uses LLM for reasoning, tools for action, and guardrails for safety",
      "controls": {
        "agent-least-privilege": {
          "description": "AI agent operates with least-privilege tool access — only tools explicitly granted per process definition are callable",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-agent-least-privilege",
                "name": "Agent Least Privilege",
                "description": "AI agent operates with least-privilege tool access — only tools explicitly granted per process definition are callable",
                "reference-url": "https://air-governance-framework.finos.org/mitigations/mi-18"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "ai-llm",
      "node-type": "ai:llm",
      "name": "Large Language Model",
      "description": "Large language model providing inference and reasoning capabilities for AI agent decisions — version-pinned for reproducible behaviour",
      "controls": {
        "model-version-pinning": {
          "description": "LLM model version is pinned to a specific checkpoint — no automatic model upgrades without governance review and regression testing",
          "requirements": [
            {
              "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
              "config": {
                "control-id": "fluxnova-model-version-pinning",
                "name": "Model Version Pinning",
                "description": "LLM model version is pinned to a specific checkpoint — no automatic model upgrades without governance review and regression testing",
                "reference-url": "https://air-governance-framework.finos.org/mitigations/mi-10"
              }
            }
          ]
        }
      }
    },
    {
      "unique-id": "ai-guardrail",
      "node-type": "ai:guardrail",
      "name": "AI Guardrail",
      "description": "Safety filter validating AI agent inputs and outputs against policy — rejects hallucinations, PII leakage, prompt injections, and policy violations before action"
    },
    {
      "unique-id": "ai-tool",
      "node-type": "ai:tool",
      "name": "AI Tool",
      "description": "Callable function exposed to the AI agent for structured external actions — wraps downstream APIs, databases, and services with typed schemas and access controls"
    }
  ],
  "relationships": [
    {
      "unique-id": "ai-engine-to-process-db",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-engine"
          },
          "destination": {
            "node": "ai-fluxnova-process-db"
          }
        }
      },
      "protocol": "JDBC",
      "description": "Engine persists AI agent process state, LLM interaction history, and audit data to the process database"
    },
    {
      "unique-id": "ai-rest-api-to-engine",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-rest-api"
          },
          "destination": {
            "node": "ai-fluxnova-engine"
          }
        }
      },
      "protocol": "HTTP",
      "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
    },
    {
      "unique-id": "ai-cockpit-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-cockpit"
          },
          "destination": {
            "node": "ai-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Cockpit queries AI agent process instances and LLM performance metrics via the REST API"
    },
    {
      "unique-id": "ai-admin-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-admin"
          },
          "destination": {
            "node": "ai-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Admin manages AI agent configuration, model versions, and guardrail policies via the REST API"
    },
    {
      "unique-id": "ai-tasklist-to-rest-api",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-tasklist"
          },
          "destination": {
            "node": "ai-fluxnova-rest-api"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Tasklist retrieves and completes human-in-the-loop review and escalation tasks via the REST API"
    },
    {
      "unique-id": "ai-platform-has-engine",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-engine"
          ]
        }
      },
      "description": "FluxNova platform contains the BPM engine"
    },
    {
      "unique-id": "ai-platform-has-rest-api",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-rest-api"
          ]
        }
      },
      "description": "FluxNova platform contains the REST API"
    },
    {
      "unique-id": "ai-platform-has-cockpit",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-cockpit"
          ]
        }
      },
      "description": "FluxNova platform contains the Cockpit monitoring app"
    },
    {
      "unique-id": "ai-platform-has-admin",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-admin"
          ]
        }
      },
      "description": "FluxNova platform contains the Admin management app"
    },
    {
      "unique-id": "ai-platform-has-tasklist",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-tasklist"
          ]
        }
      },
      "description": "FluxNova platform contains the Tasklist app"
    },
    {
      "unique-id": "ai-platform-has-process-db",
      "relationship-type": {
        "composed-of": {
          "container": "ai-fluxnova-platform",
          "nodes": [
            "ai-fluxnova-process-db"
          ]
        }
      },
      "description": "FluxNova platform contains the process database"
    },
    {
      "unique-id": "ai-engine-to-agent",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-fluxnova-engine"
          },
          "destination": {
            "node": "ai-agent"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Engine dispatches AI agent tasks via the external task worker pattern — agent polls for tasks, executes, and submits results"
    },
    {
      "unique-id": "ai-agent-to-llm",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-agent"
          },
          "destination": {
            "node": "ai-llm"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "AI agent sends prompts and context to the LLM for reasoning and decision generation"
    },
    {
      "unique-id": "ai-guardrail-to-agent",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-guardrail"
          },
          "destination": {
            "node": "ai-agent"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "Guardrail validates agent inputs before LLM invocation and agent outputs before tool execution — acts as a safety filter in the critical path"
    },
    {
      "unique-id": "ai-agent-to-tool",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "ai-agent"
          },
          "destination": {
            "node": "ai-tool"
          }
        }
      },
      "protocol": "HTTPS",
      "description": "AI agent invokes callable tools for structured external actions after guardrail approval"
    }
  ]
}
CALMDOC
)
    post_named_document "finos.fluxnova" "architectures" "fluxnova-ai-agent" "1.0.0" "$doc"
}

# Function to create user access (if endpoint exists)
create_user_access() {
    print_status "Creating user access entries..."
    
    # Create sample user access for different namespaces
    for namespace in finos finos.calm finos.traderx workshop finos.fluxnova; do
        print_status "Creating user access for namespace: $namespace"
        curl -s -X POST "$CALM_HUB_URL/api/calm/namespaces/$namespace/user-access" \
            -H "$CONTENT_TYPE" \
            -d "{
                \"username\": \"admin\",
                \"permission\": \"write\",
                \"resourceType\": \"architectures\",
                \"namespace\": \"$namespace\"
            }" || print_warning "Failed to create user access for $namespace"
    done
}

# Function to create standards
create_standards() {
    print_status "Creating standards..."

    # Create the CALM Deployment Decorator Standard in finos.calm
    local f="${CALM_SCHEMA_BASE_PATH}/draft/2026-03/standards/deployment/deployment.decorator.standard.json"
    if [[ -f "$f" ]]; then
        local doc payload
        doc=$(cat "$f")
        payload=$(jq -n \
            --arg name "CALM Deployment Decorator Standard" \
            --arg description "Deployment decorator standard for architectures" \
            --argjson doc "$doc" \
            '{name: $name, description: $description, standardJson: ($doc | tojson)}')
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            "$CALM_HUB_URL/api/calm/namespaces/finos.calm/standards" \
            -H "$CONTENT_TYPE" -d "$payload")
        if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
            print_status "Created deployment standard in finos.calm"
        elif [[ "$http_code" == "409" ]]; then
            print_warning "Deployment standard already exists, skipping"
        else
            print_warning "Failed to create deployment standard (HTTP $http_code)"
        fi
    else
        print_warning "Deployment standard not found at $f"
    fi
}

# Function to seed CALM interface examples into finos.calm
create_interfaces() {
    print_status "Creating interfaces in finos.calm..."

    local interfaces_dir="${CALM_SCHEMA_BASE_PATH}/interfaces/example"
    if [[ ! -d "$interfaces_dir" ]]; then
        print_warning "Interfaces example directory not found at $interfaces_dir, skipping"
        return
    fi

    for f in "$interfaces_dir"/*.json; do
        [[ -f "$f" ]] || continue
        local name doc payload http_code
        # Derive name from the .title field; fall back to the basename without extension
        name=$(jq -r '.title // empty' "$f")
        if [[ -z "$name" ]]; then
            name=$(basename "$f" .json)
        fi
        doc=$(cat "$f")
        payload=$(jq -n \
            --arg name "$name" \
            --arg description "CALM interface example: $name" \
            --argjson doc "$doc" \
            '{name: $name, description: $description, interfaceJson: ($doc | tojson)}')
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            "$CALM_HUB_URL/api/calm/namespaces/finos.calm/interfaces" \
            -H "$CONTENT_TYPE" -d "$payload")
        if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
            print_status "Created interface '$name' in finos.calm"
        elif [[ "$http_code" == "409" ]]; then
            print_warning "Interface '$name' already exists, skipping"
        else
            print_warning "Failed to create interface '$name' (HTTP $http_code)"
        fi
    done
}

# Map of ai-governance control IDs (as referenced in source documents) to the IDs
# actually assigned by the API. Populated by create_domains_and_controls and consumed
# by create_ai_governance_architecture to rewrite the architecture's control $refs.
AI_GOVERNANCE_CONTROL_MAP="{}"

# Function to create domains and their control requirements.
# Mirrors the MongoDB init: each subdirectory under the controls path is a domain and
# each JSON file within it is a control requirement (created at version 1.0.0).
# The API assigns control IDs from a counter, so the ID given to each ai-governance
# control is captured to allow the architecture's $refs to be rewritten to match.
create_domains_and_controls() {
    print_status "Creating domains and controls..."

    local base_path="$CALM_CONTROLS_BASE_PATH"
    if [[ -z "$base_path" ]]; then
        local script_dir
        script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
        base_path=$(realpath "$script_dir/../mongo/controls" 2>/dev/null || echo "")
    fi

    if [[ -z "$base_path" || ! -d "$base_path" ]]; then
        print_warning "Controls base path not found, skipping domains and controls"
        return
    fi

    print_status "Loading controls from: $base_path"

    for domain_dir in "$base_path"/*/; do
        [[ -d "$domain_dir" ]] || continue
        local domain
        domain=$(basename "$domain_dir")

        # Skip the security domain
        [[ "$domain" == "security" ]] && continue

        # Rename ai-governance → finos-ai-governance (domain regex forbids dots)
        local api_domain="$domain"
        [[ "$domain" == "ai-governance" ]] && api_domain="finos-ai-governance"

        print_status "Creating domain: $api_domain"
        local domain_code
        domain_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/api/calm/domains" \
            -H "$CONTENT_TYPE" \
            -d "{\"name\": \"$api_domain\"}")
        if [[ "$domain_code" == "200" || "$domain_code" == "201" ]]; then
            print_status "Created domain $api_domain"
        elif [[ "$domain_code" == "409" ]]; then
            print_warning "Domain $api_domain already exists, skipping"
        else
            print_warning "Failed to create domain $api_domain (HTTP $domain_code)"
        fi

        # Create controls in ascending controlId order so assignment is deterministic.
        local control_file
        while IFS= read -r control_file; do
            [[ -f "$control_file" ]] || continue
            local name description orig_id requirement payload
            name=$(jq -r '.name' "$control_file")
            description=$(jq -r '.description' "$control_file")
            orig_id=$(jq -r '.controlId' "$control_file")
            requirement=$(jq -c '.requirement["1-0-0"]' "$control_file")

            payload=$(jq -n \
                --arg name "$name" \
                --arg description "$description" \
                --arg requirementJson "$requirement" \
                '{name: $name, description: $description, requirementJson: $requirementJson}')

            local location new_id
            location=$(curl -s -D - -o /dev/null -X POST "$CALM_HUB_URL/api/calm/domains/$api_domain/controls" \
                -H "$CONTENT_TYPE" \
                -d "$payload" | grep -i '^location:' | tr -d '\r')
            new_id=$(echo "$location" | sed -E 's#.*/controls/([0-9]+).*#\1#')

            if [[ -n "$new_id" && "$new_id" =~ ^[0-9]+$ ]]; then
                print_status "Created control '$name' in domain $api_domain (id $new_id)"
                if [[ "$domain" == "ai-governance" ]]; then
                    AI_GOVERNANCE_CONTROL_MAP=$(echo "$AI_GOVERNANCE_CONTROL_MAP" \
                        | jq --arg k "$orig_id" --arg v "$new_id" '. + {($k): $v}')
                fi
            else
                print_warning "Failed to create control '$name' in domain $api_domain"
            fi
        done < <(find "$domain_dir" -maxdepth 1 -name '*.json' | sort)
    done
}

# Function to create the ai-governance-v2 architecture.
# The architecture's control $refs point at ai-governance control IDs from the source
# data; they are rewritten to the IDs the API actually assigned before posting.
create_ai_governance_architecture() {
    print_status "Creating ai-governance-v2 architecture..."

    # The architecture's control $refs are rewritten using the IDs assigned when the
    # ai-governance controls were created. If that map is empty (e.g. the controls base
    # path was missing so create_domains_and_controls bailed out), the refs cannot be
    # resolved, so skip rather than post an architecture with dangling references.
    if [[ -z "$AI_GOVERNANCE_CONTROL_MAP" || "$AI_GOVERNANCE_CONTROL_MAP" == "{}" ]]; then
        print_warning "No ai-governance control map available, skipping ai-governance-v2 architecture"
        return
    fi

    local doc
    doc=$(cat <<'CALMDOC'
{
    "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
    "unique-id": "mcp-api-pipeline",
    "name": "MCP Server API Pipeline",
    "description": "User \u2192 MCP Server (cloud-hosted) \u2192 API Service \u2192 Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
    "nodes": [
        {
            "unique-id": "user",
            "name": "User",
            "description": "Human end-user interacting with the MCP Server via a client application.",
            "node-type": "actor",
            "interfaces": [
                {
                    "unique-id": "user-interface",
                    "name": "User Client Interface"
                }
            ],
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/12/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-020",
                    "name": "Reputational Risk",
                    "description": "The User receives all AI-generated outputs. Content filtering, output moderation, and AI disclosure must be applied to prevent harmful or misleading content reaching users at scale.",
                    "requirements": [
                        "Implement output content filtering before responses are returned to the User.",
                        "Display AI disclosure notices to the User at session start.",
                        "Monitor user feedback channels for harm signals from AI outputs.",
                        "Establish an AI incident response and user remediation process."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/9/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-017",
                    "name": "Lack of Explainability",
                    "description": "Users receiving AI-generated responses must be able to understand the basis of outputs, particularly for high-stakes decisions. Source citations and rationale must be surfaced in the User interface.",
                    "requirements": [
                        "Surface citations and source document references in all AI-generated responses shown to the User.",
                        "Provide human-readable rationales for AI recommendations in the User interface.",
                        "Enable Users to escalate any AI-generated decision to a human agent."
                    ]
                }
            ]
        },
        {
            "unique-id": "mcp-server",
            "name": "MCP Server",
            "description": "Cloud-hosted Model Context Protocol server. Orchestrates LLM interactions, manages tool calls, and proxies requests to the API Service.",
            "node-type": "service",
            "deployment-type": "cloud",
            "interfaces": [
                {
                    "unique-id": "mcp-server-ingress",
                    "name": "MCP Server Ingress",
                    "protocol": "HTTPS",
                    "port": 443
                },
                {
                    "unique-id": "mcp-server-egress",
                    "name": "MCP Server API Egress",
                    "protocol": "HTTPS",
                    "port": 443
                }
            ],
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-010",
                    "name": "Prompt Injection",
                    "description": "The MCP Server ingress is the primary prompt injection attack surface. All user inputs must be validated and sanitised before passing to the LLM or downstream services.",
                    "requirements": [
                        "Deploy an AI firewall at the MCP Server ingress to detect and block prompt injection patterns.",
                        "Sanitise all user-supplied content before inclusion in LLM prompts.",
                        "Enforce strict system-prompt hierarchy so user messages cannot override system-level instructions.",
                        "Monitor MCP Server outputs for data exfiltration patterns or instruction-echoing.",
                        "Conduct regular red-team exercises targeting the MCP Server prompt injection surface."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/3/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-004",
                    "name": "Hallucination and Inaccurate Outputs",
                    "description": "The MCP Server is where LLM inference occurs. RAG grounding, output validation, and human-review gates must be applied before responses reach the User.",
                    "requirements": [
                        "Implement RAG grounding using verified data sourced from the API Service.",
                        "Apply output validation pipelines to MCP Server responses before delivery to the User.",
                        "Route high-stakes outputs through a human-review queue prior to delivery.",
                        "Log and monitor hallucination incidents by frequency and business impact."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/4/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-005",
                    "name": "Foundation Model Versioning",
                    "description": "The MCP Server integrates foundation models whose provider-side updates can cause silent behavioural changes propagating through the entire pipeline.",
                    "requirements": [
                        "Pin foundation model versions; only upgrade after regression testing and sign-off.",
                        "Maintain a model version registry covering all models used by the MCP Server.",
                        "Obtain advance notification of model changes from providers via contractual obligation.",
                        "Implement automated regression test suites triggered by model version changes.",
                        "Define and test rollback procedures to prior pinned model versions."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/6/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-007",
                    "name": "Availability of Foundational Model",
                    "description": "The MCP Server depends on GPU-backed third-party model infrastructure. Denial of Wallet attacks, TSP outages, and token exhaustion can render the MCP Server unavailable.",
                    "requirements": [
                        "Implement API rate limiting and token budget controls at the MCP Server.",
                        "Define SLAs with model providers and monitor compliance.",
                        "Design failover strategies including fallback to alternative model providers.",
                        "Apply prompt length controls and chunking strategies to prevent token exhaustion."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-024",
                    "name": "Agent Action Authorization Bypass",
                    "description": "The MCP Server acts as an AI agent invoking tools and calling the API Service. Injected instructions could trigger unauthorised operations without strict authorisation controls.",
                    "requirements": [
                        "Assign the MCP Server least-privilege permissions scoped to required tools and operations only.",
                        "Implement human-in-the-loop approval gates for irreversible or high-risk API actions.",
                        "Validate all MCP-to-API requests against an authorised action policy before execution.",
                        "Log all MCP-originated actions with full user context and authorisation decision."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/7/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-014",
                    "name": "Inadequate System Alignment",
                    "description": "MCP Server responses must remain aligned with the system's intended scope. Misalignment can cause scope boundary violations and regulatory exposure.",
                    "requirements": [
                        "Define the authorised scope of the MCP Server via system prompt guardrails.",
                        "Implement continuous alignment monitoring against golden evaluation datasets.",
                        "Perform prompt injection testing on all content retrieved and injected into prompts.",
                        "Implement alignment drift detection to trigger re-evaluation when quality degrades."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/8/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-016",
                    "name": "Bias and Discrimination",
                    "description": "LLM outputs generated by the MCP Server may reflect training data biases, producing discriminatory responses to users.",
                    "requirements": [
                        "Conduct bias audits on MCP Server outputs prior to production launch and at regular intervals.",
                        "Test for disparate impact across protected user characteristics.",
                        "Establish a bias incident response process including user remediation procedures."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/18/versions/1-0-0"
                    },
                    "control-id": "AIR-RC-023",
                    "name": "Intellectual Property and Copyright",
                    "description": "The MCP Server LLM may reproduce copyrighted content from training data in its outputs.",
                    "requirements": [
                        "Implement output filters to detect and suppress reproduction of copyrighted material.",
                        "Ensure model provider contracts include IP indemnification clauses.",
                        "Train operators on IP risks associated with AI-generated content."
                    ]
                }
            ]
        },
        {
            "unique-id": "api-service",
            "name": "API Service",
            "description": "Backend REST API service that processes requests from the MCP Server, applies business logic, and reads/writes data to the Database.",
            "node-type": "service",
            "deployment-type": "cloud",
            "interfaces": [
                {
                    "unique-id": "api-service-ingress",
                    "name": "API Service Ingress",
                    "protocol": "HTTPS",
                    "port": 443
                },
                {
                    "unique-id": "api-service-db-egress",
                    "name": "API Service Database Egress",
                    "protocol": "TCP",
                    "port": 5432
                }
            ],
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/17/versions/1-0-0"
                    },
                    "control-id": "AIR-RC-022",
                    "name": "Regulatory Compliance and Oversight",
                    "description": "The API Service is the enforcement point for regulatory business rules. It must maintain audit trails and support regulatory examination of AI-assisted decisions.",
                    "requirements": [
                        "Maintain an audit log of all MCP Server-originated requests and API Service responses.",
                        "Enforce data classification and handling policies at the API Service layer.",
                        "Produce decision records for all AI-assisted actions routed through the API Service.",
                        "Retain request/response logs for the required regulatory retention period."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-019",
                    "name": "Data Quality and Drift",
                    "description": "The API Service is the data supply layer for the MCP Server RAG pipeline. Data quality issues or staleness here directly degrade AI output accuracy.",
                    "requirements": [
                        "Implement automated data quality checks (accuracy, completeness, timeliness) at the API Service ingestion layer.",
                        "Monitor statistical properties of data served to the MCP Server to detect drift.",
                        "Define data freshness SLAs per use case and enforce scheduled refresh cycles.",
                        "Maintain data lineage records to support auditability of AI model inputs."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/10/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-018",
                    "name": "Model Overreach / Expanded Use",
                    "description": "The API Service must enforce scope boundaries, rejecting MCP Server requests that exceed the AI system's authorised use cases.",
                    "requirements": [
                        "Validate all incoming MCP Server requests against an approved API action register.",
                        "Reject API calls corresponding to unauthorised or out-of-scope AI operations.",
                        "Log all scope boundary violations for review by the AI governance function."
                    ]
                }
            ]
        },
        {
            "unique-id": "database",
            "name": "Database",
            "description": "Persistent data store (relational and/or vector store for RAG) used by the API Service.",
            "node-type": "datastore",
            "deployment-type": "cloud",
            "interfaces": [
                {
                    "unique-id": "database-ingress",
                    "name": "Database Ingress",
                    "protocol": "TCP",
                    "port": 5432
                }
            ],
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-002",
                    "name": "Information Leaked to Vector Store",
                    "description": "The Database may function as a vector store for the RAG pipeline. Embeddings can expose sensitive data via inversion or inference attacks without proper security controls.",
                    "requirements": [
                        "Enforce RBAC on the Database, scoping retrieval to the requesting user's authorisation.",
                        "Encrypt all data at rest using AES-256 or equivalent approved standard.",
                        "Implement comprehensive audit logging for all database queries.",
                        "Classify all stored data and enforce classification-based retrieval policies.",
                        "Conduct penetration testing targeting embedding inversion and membership inference attacks."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-019",
                    "name": "Data Quality and Drift",
                    "description": "The Database is the authoritative source of inference data for the RAG pipeline. Poor quality or stale data stored here propagates directly into AI outputs.",
                    "requirements": [
                        "Enforce data quality standards at write time including schema validation and completeness checks.",
                        "Implement scheduled data freshness reviews and automated stale-data flagging.",
                        "Maintain data lineage metadata for all records used in AI inference pipelines."
                    ]
                }
            ]
        }
    ],
    "relationships": [
        {
            "unique-id": "user-to-mcp",
            "name": "User to MCP Server",
            "description": "User sends prompts and receives AI-generated responses via the MCP Server over HTTPS.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "user",
                        "interface": "user-interface"
                    },
                    "destination": {
                        "node": "mcp-server",
                        "interface": "mcp-server-ingress"
                    }
                }
            },
            "protocol": "HTTPS",
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-010",
                    "name": "Prompt Injection",
                    "description": "This channel carries untrusted user input directly into the AI system \u2014 the highest-risk prompt injection vector. Input must be validated and firewall-inspected before any content reaches the LLM.",
                    "requirements": [
                        "Enforce TLS 1.2+ on the User-to-MCP channel.",
                        "Apply AI firewall inspection on all user messages before LLM processing.",
                        "Rate-limit user requests to prevent flooding or token-exhaustion attacks.",
                        "Authenticate and authorise all user sessions before granting MCP Server access."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-028",
                    "name": "Multi-Agent Trust Boundary Violations",
                    "description": "The User-to-MCP boundary is an external trust boundary. The MCP Server must treat all inbound user messages as untrusted and enforce strict session isolation.",
                    "requirements": [
                        "Treat all user-supplied input as untrusted at the MCP Server ingress.",
                        "Enforce strict context isolation so one user's session cannot influence another's agent context.",
                        "Implement session-level sandboxing to limit blast radius of any injected instruction."
                    ]
                }
            ]
        },
        {
            "unique-id": "mcp-to-api",
            "name": "MCP Server to API Service",
            "description": "MCP Server makes authenticated API calls to the API Service to fulfil tool calls and retrieve data for RAG grounding.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "mcp-server",
                        "interface": "mcp-server-egress"
                    },
                    "destination": {
                        "node": "api-service",
                        "interface": "api-service-ingress"
                    }
                }
            },
            "protocol": "HTTPS",
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-024",
                    "name": "Agent Action Authorization Bypass",
                    "description": "This channel carries AI agent tool calls from the MCP Server to the API Service. Injected instructions could invoke unauthorised operations without enforcement here.",
                    "requirements": [
                        "Authenticate all MCP Server requests to the API Service using short-lived scoped credentials (mTLS or signed tokens).",
                        "Enforce least-privilege: MCP Server credentials must only permit specifically required API operations.",
                        "The API Service must validate each inbound request against the authorised action policy before execution.",
                        "Require human approval for high-risk or irreversible API operations triggered via the MCP Server.",
                        "Log all calls on this channel with full request context and authorisation outcome."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-028",
                    "name": "Multi-Agent Trust Boundary Violations",
                    "description": "This channel crosses the internal trust boundary between AI orchestration (MCP Server) and the data/logic layer (API Service). MCP Server compromise must not propagate unchecked into the API Service.",
                    "requirements": [
                        "Enforce mutual TLS (mTLS) on the MCP-to-API channel.",
                        "The API Service must independently validate request authorisation \u2014 not blindly trust MCP Server-supplied context.",
                        "Implement circuit breakers to halt MCP Server API calls during detected anomalies or security incidents."
                    ]
                }
            ]
        },
        {
            "unique-id": "api-to-db",
            "name": "API Service to Database",
            "description": "API Service reads and writes data to the Database using an authenticated, encrypted database connection.",
            "relationship-type": {
                "connects": {
                    "source": {
                        "node": "api-service",
                        "interface": "api-service-db-egress"
                    },
                    "destination": {
                        "node": "database",
                        "interface": "database-ingress"
                    }
                }
            },
            "protocol": "TCP",
            "controls": [
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                    },
                    "control-id": "AIR-SEC-002",
                    "name": "Information Leaked to Vector Store",
                    "description": "This channel carries sensitive embedding queries and raw data between the API Service and the Database. Data in transit must be encrypted and access strictly scoped.",
                    "requirements": [
                        "Enforce TLS encryption on the API Service-to-Database connection.",
                        "Use parameterised queries to prevent SQL and vector injection attacks.",
                        "Scope database credentials to the minimum required tables and operations.",
                        "Propagate and audit user context on all data retrieval operations on this channel."
                    ]
                },
                {
                    "control-requirement": {
                        "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                    },
                    "control-id": "AIR-OP-019",
                    "name": "Data Quality and Drift",
                    "description": "Data flowing from the Database through this channel feeds the MCP Server RAG pipeline. Stale or degraded data directly impacts AI output accuracy.",
                    "requirements": [
                        "Implement query-time data freshness checks before returning data to the API Service.",
                        "Filter records failing quality thresholds before inclusion in RAG context.",
                        "Monitor query patterns for anomalies indicating data drift or unexpected schema changes."
                    ]
                }
            ]
        }
    ]
}
CALMDOC
)

    doc=$(echo "$doc" | jq --argjson map "$AI_GOVERNANCE_CONTROL_MAP" '
        walk(
            if type == "string" and test("^/calm/domains/ai-governance/controls/[0-9]+/versions/")
            then ( . as $orig
                   | capture("^/calm/domains/ai-governance/controls/(?<id>[0-9]+)/versions/(?<rest>.*)$")
                   | if $map[.id] then
                         "/calm/domains/ai-governance/controls/" + $map[.id] + "/versions/" + .rest
                     else $orig end )
            else . end
        )')

    post_document "ai-governance-v2" "architectures" "architectureJson" "mcp-api-pipeline" "User to MCP Server (cloud-hosted) to API Service to Database. FINOS AIR AI Governance controls applied directly on nodes and relationships." "$doc"
}

# Main execution
create_timeline_demo() {
    print_status "Creating workshop timeline demo architectures + explicit timeline..."

    # --- Payments Service (implied timeline) ---------------------------------
    # No stored timeline; the timeline bar projects one from the version list.
    local payments_v1='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "api", "node-type": "service", "name": "Payments API", "description": "Public payments API" },
            { "unique-id": "db", "node-type": "database", "name": "Payments DB", "description": "Stores payment records" }
        ],
        "relationships": [
            { "unique-id": "api-to-db", "description": "Reads/writes payments",
              "relationship-type": { "connects": { "source": { "node": "api" }, "destination": { "node": "db" } } } }
        ]
    }'
    local payments_v2='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "api", "node-type": "service", "name": "Payments API", "description": "Public payments API" },
            { "unique-id": "db", "node-type": "database", "name": "Payments DB", "description": "Stores payment records" },
            { "unique-id": "cache", "node-type": "service", "name": "Idempotency Cache", "description": "Caches request keys" }
        ],
        "relationships": [
            { "unique-id": "api-to-db", "description": "Reads/writes payments",
              "relationship-type": { "connects": { "source": { "node": "api" }, "destination": { "node": "db" } } } },
            { "unique-id": "api-to-cache", "description": "Checks idempotency cache",
              "relationship-type": { "connects": { "source": { "node": "api" }, "destination": { "node": "cache" } } } }
        ]
    }'
    local payments_v3='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "api", "node-type": "service", "name": "Payments API", "description": "Public payments API" },
            { "unique-id": "db", "node-type": "database", "name": "Payments DB", "description": "Stores payment records" },
            { "unique-id": "cache", "node-type": "service", "name": "Idempotency Cache", "description": "Caches request keys" },
            { "unique-id": "worker", "node-type": "service", "name": "Settlement Worker", "description": "Async settlement processor" }
        ],
        "relationships": [
            { "unique-id": "api-to-db", "description": "Reads/writes payments",
              "relationship-type": { "connects": { "source": { "node": "api" }, "destination": { "node": "db" } } } },
            { "unique-id": "api-to-cache", "description": "Checks idempotency cache",
              "relationship-type": { "connects": { "source": { "node": "api" }, "destination": { "node": "cache" } } } },
            { "unique-id": "worker-to-db", "description": "Async settlement updates DB",
              "relationship-type": { "connects": { "source": { "node": "worker" }, "destination": { "node": "db" } } } }
        ]
    }'

    post_document "workshop" "architectures" "architectureJson" \
        "Payments Service (implied timeline)" \
        "Demo architecture with no curated timeline — the bar projects one from the version list." \
        "$payments_v1"

    local payments_id
    payments_id=$(get_resource_id_by_name "workshop" "architectures" "Payments Service (implied timeline)")
    if [[ -n "$payments_id" ]]; then
        post_architecture_version "workshop" "$payments_id" "1.1.0" \
            "Payments Service (implied timeline)" "Added idempotency cache." "$payments_v2"
        post_architecture_version "workshop" "$payments_id" "1.2.0" \
            "Payments Service (implied timeline)" "Added async settlement worker." "$payments_v3"
    else
        print_warning "Could not resolve Payments Service id; skipping additional versions"
    fi

    # --- Trading Platform (explicit timeline) --------------------------------
    # Four versions; an explicit stored timeline with four moments, with the
    # *third* moment marked as current-moment so testers can see the NOW badge
    # anchored on a non-latest version.
    local trading_v1='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "gateway", "node-type": "service", "name": "Order Gateway", "description": "Accepts client orders" },
            { "unique-id": "matching", "node-type": "service", "name": "Matching Engine", "description": "Matches buy/sell orders" }
        ],
        "relationships": [
            { "unique-id": "gateway-to-matching", "description": "Gateway forwards orders",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "matching" } } } }
        ]
    }'
    local trading_v2='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "gateway", "node-type": "service", "name": "Order Gateway", "description": "Accepts client orders" },
            { "unique-id": "matching", "node-type": "service", "name": "Matching Engine", "description": "Matches buy/sell orders" },
            { "unique-id": "order-book", "node-type": "database", "name": "Order Book", "description": "Centralised order book" }
        ],
        "relationships": [
            { "unique-id": "gateway-to-matching", "description": "Gateway forwards orders",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "matching" } } } },
            { "unique-id": "matching-to-order-book", "description": "Matching engine persists state",
              "relationship-type": { "connects": { "source": { "node": "matching" }, "destination": { "node": "order-book" } } } }
        ]
    }'
    local trading_v3='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "gateway", "node-type": "service", "name": "Order Gateway", "description": "Accepts client orders" },
            { "unique-id": "matching", "node-type": "service", "name": "Matching Engine", "description": "Matches buy/sell orders" },
            { "unique-id": "order-book", "node-type": "database", "name": "Order Book", "description": "Centralised order book" },
            { "unique-id": "risk", "node-type": "service", "name": "Risk Engine", "description": "Pre-trade risk checks" }
        ],
        "relationships": [
            { "unique-id": "gateway-to-matching", "description": "Gateway forwards orders",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "matching" } } } },
            { "unique-id": "matching-to-order-book", "description": "Matching engine persists state",
              "relationship-type": { "connects": { "source": { "node": "matching" }, "destination": { "node": "order-book" } } } },
            { "unique-id": "gateway-to-risk", "description": "Gateway runs pre-trade risk checks",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "risk" } } } }
        ]
    }'
    local trading_v4='{
        "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
        "nodes": [
            { "unique-id": "gateway", "node-type": "service", "name": "Order Gateway", "description": "Accepts client orders" },
            { "unique-id": "matching", "node-type": "service", "name": "Matching Engine", "description": "Matches buy/sell orders" },
            { "unique-id": "order-book", "node-type": "database", "name": "Order Book", "description": "Centralised order book" },
            { "unique-id": "risk", "node-type": "service", "name": "Risk Engine", "description": "Pre-trade risk checks" },
            { "unique-id": "settlement", "node-type": "service", "name": "Settlement Engine", "description": "Post-trade settlement" }
        ],
        "relationships": [
            { "unique-id": "gateway-to-matching", "description": "Gateway forwards orders",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "matching" } } } },
            { "unique-id": "matching-to-order-book", "description": "Matching engine persists state",
              "relationship-type": { "connects": { "source": { "node": "matching" }, "destination": { "node": "order-book" } } } },
            { "unique-id": "gateway-to-risk", "description": "Gateway runs pre-trade risk checks",
              "relationship-type": { "connects": { "source": { "node": "gateway" }, "destination": { "node": "risk" } } } },
            { "unique-id": "matching-to-settlement", "description": "Matched trades flow to settlement",
              "relationship-type": { "connects": { "source": { "node": "matching" }, "destination": { "node": "settlement" } } } }
        ]
    }'

    post_document "workshop" "architectures" "architectureJson" \
        "Trading Platform (explicit timeline)" \
        "Demo architecture with a curated timeline. Has four versions; the explicit timeline marks the third as current." \
        "$trading_v1"

    local trading_id
    trading_id=$(get_resource_id_by_name "workshop" "architectures" "Trading Platform (explicit timeline)")
    if [[ -z "$trading_id" ]]; then
        print_warning "Could not resolve Trading Platform id; skipping additional versions + timeline"
        return
    fi

    post_architecture_version "workshop" "$trading_id" "1.1.0" \
        "Trading Platform (explicit timeline)" "Added centralised order book." "$trading_v2"
    post_architecture_version "workshop" "$trading_id" "2.0.0" \
        "Trading Platform (explicit timeline)" "Added pre-trade risk engine." "$trading_v3"
    post_architecture_version "workshop" "$trading_id" "3.0.0" \
        "Trading Platform (explicit timeline)" "Added post-trade settlement." "$trading_v4"

    # Explicit stored timeline: 4 curated moments referencing the 4 versions
    # above. current-moment = "risk-controls" (the THIRD moment, v2.0.0) — even
    # though there is a fourth (v3.0.0), so NOW does not follow the latest.
    local timeline_doc
    timeline_doc=$(jq -n --arg id "$trading_id" '
    {
        "$schema": "https://calm.finos.org/release/1.2/meta/calm-timeline.json",
        "current-moment": "risk-controls",
        "metadata": { "title": "Trading Platform Timeline", "owner": "Trading Platform Team" },
        "moments": [
            { "unique-id": "initial-launch", "node-type": "moment", "name": "Initial launch",
              "description": "Order gateway + matching engine", "valid-from": "2024-01-15",
              "details": { "detailed-architecture": ("/calm/namespaces/workshop/architectures/" + $id + "/versions/1.0.0") },
              "adrs": ["https://example.com/adr/0001-initial-trading-architecture"] },
            { "unique-id": "order-book-rollout", "node-type": "moment", "name": "Order book rollout",
              "description": "Centralised order book", "valid-from": "2024-04-01",
              "details": { "detailed-architecture": ("/calm/namespaces/workshop/architectures/" + $id + "/versions/1.1.0") },
              "adrs": ["https://example.com/adr/0002-order-book"] },
            { "unique-id": "risk-controls", "node-type": "moment", "name": "Risk controls go-live",
              "description": "Added pre-trade risk engine", "valid-from": "2024-09-01",
              "details": { "detailed-architecture": ("/calm/namespaces/workshop/architectures/" + $id + "/versions/2.0.0") },
              "adrs": ["https://example.com/adr/0003-pre-trade-risk"] },
            { "unique-id": "settlement-go-live", "node-type": "moment", "name": "Settlement go-live",
              "description": "Added post-trade settlement", "valid-from": "2025-02-01",
              "details": { "detailed-architecture": ("/calm/namespaces/workshop/architectures/" + $id + "/versions/3.0.0") },
              "adrs": ["https://example.com/adr/0004-settlement"] }
        ]
    }')

    local tl_payload
    tl_payload=$(jq -n \
        --arg n "Trading Platform Timeline" \
        --arg d "Curated timeline with four moments. current-moment is the third (Risk controls go-live)." \
        --argjson doc "$timeline_doc" \
        '{name: $n, description: $d, timelineJson: ($doc|tojson)}')

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "$CALM_HUB_URL/api/calm/namespaces/workshop/timelines" \
        -H "$CONTENT_TYPE" -d "$tl_payload")
    if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
        print_status "Created explicit timeline for Trading Platform in workshop"
    elif [[ "$http_code" == "409" ]]; then
        print_warning "Trading Platform timeline already exists, skipping"
    else
        print_warning "Failed to create Trading Platform timeline (HTTP $http_code)"
    fi

    # --- Demo Pattern (implied timeline, 3 versions) -------------------------
    # Patterns have no explicit timeline, so the bar always shows the implied
    # projection — useful for testing the pattern path of the timeline UI.
    local pattern_v1='{
        "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
        "title": "Demo Pattern",
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "minItems": 1,
                "prefixItems": [
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "api-gateway" },
                            "node-type": { "const": "system" },
                            "name": { "const": "API Gateway" },
                            "description": { "const": "Entry point for the demo pattern." }
                        }
                    }
                ]
            }
        }
    }'
    local pattern_v2='{
        "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
        "title": "Demo Pattern",
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "minItems": 2,
                "prefixItems": [
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "api-gateway" },
                            "node-type": { "const": "system" },
                            "name": { "const": "API Gateway" },
                            "description": { "const": "Entry point for the demo pattern." }
                        }
                    },
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "service" },
                            "node-type": { "const": "service" },
                            "name": { "const": "Downstream Service" },
                            "description": { "const": "Service called by the gateway." }
                        }
                    }
                ]
            }
        }
    }'
    local pattern_v3='{
        "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
        "title": "Demo Pattern",
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "minItems": 2,
                "prefixItems": [
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "api-gateway" },
                            "node-type": { "const": "system" },
                            "name": { "const": "API Gateway" },
                            "description": { "const": "Entry point for the demo pattern." }
                        }
                    },
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "service" },
                            "node-type": { "const": "service" },
                            "name": { "const": "Downstream Service" },
                            "description": { "const": "Service called by the gateway." }
                        }
                    }
                ]
            },
            "relationships": {
                "type": "array",
                "minItems": 1,
                "prefixItems": [
                    {
                        "type": "object",
                        "properties": {
                            "unique-id": { "const": "gateway-interacts-service" },
                            "description": { "const": "Gateway calls downstream service." },
                            "relationship-type": {
                                "const": {
                                    "interacts": {
                                        "actor": "api-gateway",
                                        "nodes": ["service"]
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    }'

    post_document "workshop" "patterns" "patternJson" \
        "Demo Pattern (implied timeline)" \
        "Demo pattern with three versions to exercise the pattern path of the timeline bar." \
        "$pattern_v1"

    local pattern_id
    pattern_id=$(get_resource_id_by_name "workshop" "patterns" "Demo Pattern (implied timeline)")
    if [[ -n "$pattern_id" ]]; then
        post_pattern_version "workshop" "$pattern_id" "1.1.0" \
            "Demo Pattern (implied timeline)" "Added downstream service node." "$pattern_v2"
        post_pattern_version "workshop" "$pattern_id" "2.0.0" \
            "Demo Pattern (implied timeline)" "Added gateway→service interacts relationship." "$pattern_v3"
    else
        print_warning "Could not resolve Demo Pattern id; skipping additional versions"
    fi
}

create_layouts() {
    print_status "Creating default layouts..."

    # Seed a layout for the Conference Signup Architecture using the new nodes-map format.
    # The architecture is created in create_architectures() under the "workshop" namespace;
    # its id is resolved dynamically the same way version-seeding does.
    local conf_arch_id
    conf_arch_id=$(get_resource_id_by_name "workshop" "architectures" "Conference Signup Architecture")

    if [[ -z "$conf_arch_id" ]]; then
        print_warning "Could not resolve Conference Signup Architecture id; skipping layout seed"
        return
    fi

    local layout_json
    layout_json=$(cat <<'CALMDOC'
{
    "for": "/api/calm/namespaces/workshop/architectures/__ARCH_ID__",
    "name": "Default",
    "description": "Seeded demo layout for the Conference Signup Architecture",
    "nodes": {
        "conference-website":  { "x": 50,  "y": 30,  "w": 180, "h": 60 },
        "load-balancer":       { "x": 300, "y": 30,  "w": 160, "h": 50 },
        "attendees":           { "x": 300, "y": 150, "w": 160, "h": 60 },
        "attendees-store":     { "x": 150, "y": 300, "w": 170, "h": 60 },
        "attendees-cache":     { "x": 450, "y": 300, "w": 160, "h": 60 },
        "k8s-cluster":         { "x": 100, "y": 100, "w": 560, "h": 300 }
    }
}
CALMDOC
)
    # Replace the placeholder with the actual architecture id
    layout_json="${layout_json//__ARCH_ID__/$conf_arch_id}"

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        "$CALM_HUB_URL/api/calm/namespaces/workshop/architectures/$conf_arch_id/layout" \
        -H "Content-Type: application/json" \
        -d "$layout_json")

    if [[ "$http_code" == "204" ]]; then
        print_status "Created default layout for Conference Signup Architecture (id=$conf_arch_id)"
    else
        print_warning "Failed to create layout for Conference Signup Architecture (HTTP $http_code)"
    fi
}

main() {
    print_status "Starting CalmHub NitriteDB initialization..."
    print_status "Target URL: $CALM_HUB_URL"

    # Check if CalmHub is running
    check_calmhub_status

    # Initialize data in order
    resolve_schema_base_path
    create_namespaces
    create_core_schemas
    create_domains_and_controls
    create_patterns
    create_flows
    create_architectures
    create_layouts
    create_user_access
    create_standards
    create_interfaces
    create_timeline_demo

    print_status "CalmHub NitriteDB initialization completed!"
    print_status "Note: Some operations may have failed if the corresponding REST endpoints are not yet implemented."
    print_status "This is expected for a system in development."
}

# Help function
show_help() {
    echo "CalmHub NitriteDB Initialization Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help               Show this help message"
    echo "  -u, --url URL            Set CalmHub URL (default: http://localhost:8080)"
    echo "  -s, --schema-path PATH   Set the calm/ base path for schema loading"
    echo "  -c, --controls-path PATH Set the base path for domain control requirements"
    echo ""
    echo "Environment Variables:"
    echo "  CALM_HUB_URL            CalmHub base URL (default: http://localhost:8080)"
    echo "  CALM_SCHEMA_BASE_PATH   Path to the calm/ directory containing release/ and draft/ subdirectories"
    echo "                          (default: auto-detected relative to this script)"
    echo "  CALM_CONTROLS_BASE_PATH Path to the controls directory containing one subdirectory per domain,"
    echo "                          each holding control requirement JSON files"
    echo "                          (default: auto-detected as ../mongo/controls relative to this script)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default URL"
    echo "  $0 -u http://localhost:9090          # Use custom URL"
    echo "  CALM_HUB_URL=http://calm.local $0    # Use environment variable"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--url)
            CALM_HUB_URL="$2"
            shift 2
            ;;
        -s|--schema-path)
            CALM_SCHEMA_BASE_PATH="$2"
            shift 2
            ;;
        -c|--controls-path)
            CALM_CONTROLS_BASE_PATH="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
