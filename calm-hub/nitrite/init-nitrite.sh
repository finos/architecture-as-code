#!/bin/bash

# CalmHub NitriteDB Initialization Script
# This script initializes a NitriteDB instance with the same data as the MongoDB init script
# but using REST API calls to the CalmHub application

set -e

# Configuration
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8080}"
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
    for namespace in finos workshop traderx ai-governance-v2; do
        print_status "Creating namespace: $namespace"
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/calm/namespaces" \
            -H "$CONTENT_TYPE" \
            -d "{\"name\": \"$namespace\", \"description\": \"$namespace namespace\"}")
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

# Function to create core schemas
create_core_schemas() {
    print_status "Creating core schemas..."

    local base_path="$CALM_SCHEMA_BASE_PATH"

    if [[ -z "$base_path" ]]; then
        # Try to find the calm directory relative to this script's location
        local script_dir
        script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
        base_path=$(realpath "$script_dir/../../calm" 2>/dev/null || echo "")
    fi

    if [[ -z "$base_path" || ! -d "$base_path" ]]; then
        print_error "CALM schema base path not found. Set CALM_SCHEMA_BASE_PATH to the calm/ directory."
        return 1
    fi

    print_status "Loading schemas from: $base_path"
    load_schemas_from_dir "${base_path}/release" "release"
    load_schemas_from_dir "${base_path}/draft" "draft"
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
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/calm/namespaces/$namespace/$resource" \
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

# Look up the numeric id of a namespace-scoped resource by its name.
# Usage: get_resource_id_by_name <namespace> <resource> <name>
get_resource_id_by_name() {
    local namespace="$1"
    local resource="$2"
    local name="$3"

    curl -s "$CALM_HUB_URL/calm/namespaces/$namespace/$resource" -H "$CONTENT_TYPE" \
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
        "$CALM_HUB_URL/calm/namespaces/$namespace/architectures/$architecture_id/versions/$version" \
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
    post_document "finos" "patterns" "patternJson" "API Gateway Pattern" "API Gateway pattern for verifying authorization and access to downstream systems" "$doc"

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
    
    # FINOS Flow 1
    print_status "Creating FINOS flow 1..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-1",
            "title": "Flow 1",
            "description": "This is a non-compliant flow document. Just creating something to simulate"
        }
CALMDOC
)
    post_document "finos" "flows" "flowJson" "Flow 1" "This is a non-compliant flow document. Just creating something to simulate" "$doc"

    # FINOS Flow 2
    print_status "Creating FINOS flow 2..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-2",
            "title": "Flow 2",
            "description": "This is a non-compliant flow document. Just creating something to simulate"
        }
CALMDOC
)
    post_document "finos" "flows" "flowJson" "Flow 2" "This is a non-compliant flow document. Just creating something to simulate" "$doc"

    # TraderX Flow 1 - Add or Update Account
    print_status "Creating TraderX flow 1..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
            "$id": "https://calm.finos.org/traderx/flows/add-update-account.json",
            "unique-id": "flow-add-update-account",
            "name": "Add or Update Account",
            "description": "Flow for adding or updating account information in the database.",
            "transitions": [
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 1,
                    "summary": "Submit Account Create/Update"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 2,
                    "summary": "inserts or updates account"
                },
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 3,
                    "summary": "Returns Account Create/Update Response Status",
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
    post_document "traderx" "flows" "flowJson" "Add or Update Account" "Flow for adding or updating account information in the database." "$doc"

    # TraderX Flow 2 - Load List of Accounts
    print_status "Creating TraderX flow 2..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
            "$id": "https://calm.finos.org/samples/traderx/flows/load-list-of-accounts.json",
            "unique-id": "flow-load-list-of-accounts",
            "name": "Load List of Accounts",
            "description": "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection.",
            "transitions": [
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 1,
                    "summary": "Load list of accounts"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 2,
                    "summary": "Query for all Accounts"
                },
                {
                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                    "sequence-number": 3,
                    "summary": "Returns list of accounts",
                    "direction": "destination-to-source"
                },
                {
                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                    "sequence-number": 4,
                    "summary": "Returns list of accounts",
                    "direction": "destination-to-source"
                }
            ]
        }
CALMDOC
)
    post_document "traderx" "flows" "flowJson" "Load List of Accounts" "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection." "$doc"
}

# Function to create architectures
create_architectures() {
    print_status "Creating architectures..."
    
    # FINOS Architecture
    print_status "Creating FINOS architecture..."
    local doc
    doc=$(cat <<'CALMDOC'
{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/arch-1",
            "title": "Architecture 1",
            "description": "This is a non-compliant arch document. Just creating something to simulate"
        }
CALMDOC
)
    post_document "finos" "architectures" "architectureJson" "Architecture 1" "This is a non-compliant arch document. Just creating something to simulate" "$doc"

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
    post_document "traderx" "architectures" "architectureJson" "TraderX Architecture" "TraderX simple trading system architecture" "$doc"
}

# Function to create user access (if endpoint exists)
create_user_access() {
    print_status "Creating user access entries..."
    
    # Create sample user access for different namespaces
    for namespace in finos workshop traderx ai-governance-v2; do
        print_status "Creating user access for namespace: $namespace"
        curl -s -X POST "$CALM_HUB_URL/calm/namespaces/$namespace/user-access" \
            -H "$CONTENT_TYPE" \
            -d "{
                \"username\": \"admin\",
                \"permission\": \"write\",
                \"resourceType\": \"architectures\",
                \"namespace\": \"$namespace\"
            }" || print_warning "Failed to create user access for $namespace"
    done
}

# Function to create standards (if implemented)
create_standards() {
    print_status "Creating standards..."
    
    # Create a sample NIST standard
    print_status "Creating NIST standard..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/finos/standards" \
        -H "$CONTENT_TYPE" \
        -d '{
            "name": "NIST Cybersecurity Framework",
            "description": "NIST Cybersecurity Framework standard",
            "standardJson": "{\"$schema\":\"https://json-schema.org/draft/2020-12/schema\",\"title\":\"NIST Cybersecurity Framework\",\"type\":\"object\",\"properties\":{\"identify\":{\"type\":\"object\",\"description\":\"Identify function\"},\"protect\":{\"type\":\"object\",\"description\":\"Protect function\"}}}"
        }' || print_warning "Failed to create NIST standard"
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

        print_status "Creating domain: $domain"
        local domain_code
        domain_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CALM_HUB_URL/calm/domains" \
            -H "$CONTENT_TYPE" \
            -d "{\"name\": \"$domain\"}")
        if [[ "$domain_code" == "200" || "$domain_code" == "201" ]]; then
            print_status "Created domain $domain"
        elif [[ "$domain_code" == "409" ]]; then
            print_warning "Domain $domain already exists, skipping"
        else
            print_warning "Failed to create domain $domain (HTTP $domain_code)"
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
            location=$(curl -s -D - -o /dev/null -X POST "$CALM_HUB_URL/calm/domains/$domain/controls" \
                -H "$CONTENT_TYPE" \
                -d "$payload" | grep -i '^location:' | tr -d '\r')
            new_id=$(echo "$location" | sed -E 's#.*/controls/([0-9]+).*#\1#')

            if [[ -n "$new_id" && "$new_id" =~ ^[0-9]+$ ]]; then
                print_status "Created control '$name' in domain $domain (id $new_id)"
                if [[ "$domain" == "ai-governance" ]]; then
                    AI_GOVERNANCE_CONTROL_MAP=$(echo "$AI_GOVERNANCE_CONTROL_MAP" \
                        | jq --arg k "$orig_id" --arg v "$new_id" '. + {($k): $v}')
                fi
            else
                print_warning "Failed to create control '$name' in domain $domain"
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
main() {
    print_status "Starting CalmHub NitriteDB initialization..."
    print_status "Target URL: $CALM_HUB_URL"
    
    # Check if CalmHub is running
    check_calmhub_status
    
    # Initialize data in order
    create_namespaces
    create_core_schemas
    create_domains_and_controls
    create_patterns
    create_flows
    create_architectures
    create_ai_governance_architecture
    create_user_access
    create_standards
    
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
