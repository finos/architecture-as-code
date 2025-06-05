#!/bin/bash

# CalmHub NitriteDB Initialization Script
# This script initializes a NitriteDB instance with the same data as the MongoDB init script
# but using REST API calls to the CalmHub application

set -e

# Configuration
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8080}"
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
    
    # Create required namespaces
    for namespace in finos workshop traderx; do
        print_status "Creating namespace: $namespace"
        curl -s -X POST "$CALM_HUB_URL/calm/namespaces" \
            -H "$CONTENT_TYPE" \
            -d "{\"namespace\": \"$namespace\"}" || print_warning "Failed to create namespace $namespace"
    done
}

# Function to create core schemas
create_core_schemas() {
    print_status "Creating core schemas..."
    
    print_status "Creating schema version 2025-03..."
    curl -s -X POST "$CALM_HUB_URL/calm/schemas" \
        -H "$CONTENT_TYPE" \
        -d '{
            "version": "2025-03",
            "schemas": {
                "calm.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                    "$vocabulary": {
                        "https://json-schema.org/draft/2020-12/vocab/core": true,
                        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
                        "https://json-schema.org/draft/2020-12/vocab/validation": true,
                        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
                        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
                        "https://json-schema.org/draft/2020-12/vocab/content": true,
                        "https://calm.finos.org/calm/schemas/2025-03/meta/core.json": true
                    },
                    "$dynamicAnchor": "meta",
                    "title": "Common Architecture Language Model (CALM) Schema",
                    "allOf": [
                        { "$ref": "https://json-schema.org/draft/2020-12/schema" },
                        { "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json" }
                    ]
                },
                "control.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json",
                    "title": "Common Architecture Language Model Controls",
                    "description": "Controls model requirements for domains. For example, a security domain contains a series of control requirements",
                    "defs": {
                        "control-detail": {
                            "type": "object",
                            "properties": {
                                "control-requirement-url": {
                                    "type": "string",
                                    "description": "The requirement schema that specifies how a control should be defined"
                                }
                            }
                        }
                    }
                },
                "control-requirement.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/control-requirement.json",
                    "title": "Common Architecture Language Model Control Requirement",
                    "description": "Schema for defining control requirements within the Common Architecture Language Model.",
                    "type": "object",
                    "properties": {
                        "control-requirement-id": {
                            "type": "string",
                            "description": "Unique identifier for the control requirement"
                        },
                        "title": {
                            "type": "string",
                            "description": "Title of the control requirement"
                        },
                        "description": {
                            "type": "string",
                            "description": "Detailed description of the control requirement"
                        }
                    },
                    "required": ["control-requirement-id", "title", "description"]
                },
                "core.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json",
                    "title": "Common Architecture Language Model (CALM) Vocab",
                    "properties": {},
                    "defs": {
                        "node": {
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "type": "string"
                                },
                                "node-type": {
                                    "$ref": "#/defs/node-type-definition"
                                },
                                "name": {
                                    "type": "string"
                                },
                                "description": {
                                    "type": "string"
                                }
                            }
                        },
                        "relationship": {
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "type": "string"
                                },
                                "description": {
                                    "type": "string"
                                },
                                "relationship-type": {
                                    "type": "string"
                                }
                            }
                        },
                        "node-type-definition": {
                            "enum": [
                                "actor",
                                "ecosystem",
                                "system",
                                "service",
                                "database",
                                "datastore"
                            ]
                        },
                        "metadata": {
                            "type": "array",
                            "items": {
                                "type": "object"
                            }
                        }
                    }
                },
                "evidence.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/drat/2025-03/meta/evidence.json",
                    "title": "Common Architecture Language Model Evidence",
                    "description": "Schema for defining evidence within the Common Architecture Language Model.",
                    "type": "object",
                    "properties": {
                        "evidence-id": {
                            "type": "string",
                            "description": "Unique identifier for the evidence"
                        },
                        "evidence-type": {
                            "type": "string",
                            "description": "Type of evidence"
                        },
                        "description": {
                            "type": "string",
                            "description": "Description of the evidence"
                        },
                        "source": {
                            "type": "string",
                            "description": "Source of the evidence"
                        }
                    },
                    "required": ["evidence-id", "evidence-type", "description"]
                },
                "flow.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/flow.json",
                    "title": "Business Flow Model",
                    "description": "Defines business flows that relate to technical architectures, allowing mapping of flows to technical components and attaching control requirements.",
                    "type": "object",
                    "properties": {
                        "flow-id": {
                            "type": "string",
                            "description": "Unique identifier for the flow"
                        },
                        "name": {
                            "type": "string",
                            "description": "Name of the flow"
                        },
                        "description": {
                            "type": "string",
                            "description": "Description of the flow"
                        },
                        "steps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "step-id": {
                                        "type": "string"
                                    },
                                    "name": {
                                        "type": "string"
                                    },
                                    "description": {
                                        "type": "string"
                                    }
                                }
                            }
                        }
                    },
                    "required": ["flow-id", "name", "steps"]
                },
                "interface.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json",
                    "title": "Common Architecture Language Model Interfaces",
                    "defs": {
                        "interface-type": {
                            "type": "object",
                            "properties": {
                                "unique-id": {
                                    "type": "string"
                                },
                                "interface-type": {
                                    "type": "string"
                                }
                            }
                        },
                        "rate-limit-key": {
                            "type": "object",
                            "properties": {
                                "key-type": {
                                    "$ref": "#/defs/rate-limit-key-type"
                                }
                            }
                        },
                        "rate-limit-key-type": {
                            "enum": ["user", "ip", "global"]
                        }
                    }
                },
                "units.json": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/units.json",
                    "title": "Common Architecture Language Model Units",
                    "description": "Schema for defining units of measurement within the Common Architecture Language Model.",
                    "type": "object",
                    "properties": {
                        "unit-id": {
                            "type": "string",
                            "description": "Unique identifier for the unit"
                        },
                        "name": {
                            "type": "string",
                            "description": "Name of the unit"
                        },
                        "symbol": {
                            "type": "string",
                            "description": "Symbol representing the unit"
                        },
                        "type": {
                            "type": "string",
                            "enum": ["time", "data", "frequency", "count"],
                            "description": "Type of unit"
                        }
                    },
                    "required": ["unit-id", "name", "type"]
                }
            }
        }' || print_warning "Failed to create core schemas"
}

# Function to create patterns
create_patterns() {
    print_status "Creating patterns..."
    
    # FINOS API Gateway Pattern
    print_status "Creating FINOS API Gateway Pattern..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/finos/patterns" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create FINOS API Gateway Pattern"

    # Workshop Conference Signup Pattern (Pattern 1) - Exact MongoDB content
    print_status "Creating Workshop Conference Signup Pattern..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/workshop/patterns" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create Workshop Conference Signup Pattern"

    # Workshop Conference Secure Signup Pattern (Pattern 2) - Exact MongoDB content
    print_status "Creating Workshop Conference Secure Signup Pattern..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/workshop/patterns" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create Workshop Conference Secure Signup Pattern"
}

# Function to create flows
create_flows() {
    print_status "Creating flows..."
    
    # FINOS Flow 1
    print_status "Creating FINOS flow 1..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/finos/flows" \
        -H "$CONTENT_TYPE" \
        -d '{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-1",
            "title": "Flow 1",
            "description": "This is a non-compliant flow document. Just creating something to simulate"
        }' || print_warning "Failed to create FINOS flow 1"

    # FINOS Flow 2
    print_status "Creating FINOS flow 2..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/finos/flows" \
        -H "$CONTENT_TYPE" \
        -d '{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-2",
            "title": "Flow 2",
            "description": "This is a non-compliant flow document. Just creating something to simulate"
        }' || print_warning "Failed to create FINOS flow 2"

    # TraderX Flow 1 - Add or Update Account
    print_status "Creating TraderX flow 1..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/traderx/flows" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create TraderX flow 1"

    # TraderX Flow 2 - Load List of Accounts
    print_status "Creating TraderX flow 2..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/traderx/flows" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create TraderX flow 2"
}

# Function to create architectures
create_architectures() {
    print_status "Creating architectures..."
    
    # FINOS Architecture
    print_status "Creating FINOS architecture..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/finos/architectures" \
        -H "$CONTENT_TYPE" \
        -d '{
            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/arch-1",
            "title": "Architecture 1",
            "description": "This is a non-compliant arch document. Just creating something to simulate"
        }' || print_warning "Failed to create FINOS architecture"

    # Workshop Architecture
    print_status "Creating Workshop architecture..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/workshop/architectures" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create Workshop architecture"

    # TraderX Architecture
    print_status "Creating TraderX architecture..."
    curl -s -X POST "$CALM_HUB_URL/calm/namespaces/traderx/architectures" \
        -H "$CONTENT_TYPE" \
        -d '{
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
        }' || print_warning "Failed to create TraderX architecture"
}

# Function to create user access (if endpoint exists)
create_user_access() {
    print_status "Creating user access entries..."
    
    # Create sample user access for different namespaces
    for namespace in finos workshop traderx; do
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

# Main execution
main() {
    print_status "Starting CalmHub NitriteDB initialization..."
    print_status "Target URL: $CALM_HUB_URL"
    
    # Check if CalmHub is running
    check_calmhub_status
    
    # Initialize data in order
    create_namespaces
    create_core_schemas
    create_patterns
    create_flows
    create_architectures
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
    echo "  -h, --help     Show this help message"
    echo "  -u, --url URL  Set CalmHub URL (default: http://localhost:8080)"
    echo ""
    echo "Environment Variables:"
    echo "  CALM_HUB_URL   CalmHub base URL (default: http://localhost:8080)"
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
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
