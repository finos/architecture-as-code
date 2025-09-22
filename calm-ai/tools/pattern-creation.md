# CALM Pattern Creation Guide

## Critical Requirements

🚨 **ALWAYS call the pattern creation tool before creating any patterns**

## Overview

Patterns in CALM are JSON schemas that provide reusable, instantiable architecture templates. They define repeatable architectural solutions with configurable options that can be generated using the `calm generate` command.

## Pattern Structure

A CALM pattern is a JSON schema that:

- Extends the base CALM architecture schema
- Defines constrained node and relationship options using JSON schema constructs
- Provides optionality through `anyOf`, `oneOf`, and other schema features
- Can be instantiated to create concrete architectures

## Basic Pattern Schema

```json
{
    "$schema": "https://calm.finos.org/release/1.0/meta/calm.json",
    "$id": "https://your-domain.com/patterns/my-pattern.json",
    "title": "My Architecture Pattern",
    "type": "object",
    "properties": {
        "nodes": {
            "type": "array",
            "maxItems": 3,
            "prefixItems": [
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": {
                            "const": "frontend"
                        },
                        "name": {
                            "const": "Frontend Application"
                        },
                        "node-type": {
                            "const": "webclient"
                        }
                    }
                }
            ]
        },
        "relationships": {
            "type": "array",
            "minItems": 1,
            "maxItems": 2
        }
    },
    "required": ["nodes", "relationships"]
}
```

## Providing Options with anyOf/oneOf

Patterns use JSON schema constructs to provide choices and options:

### Node Options with anyOf

```json
{
    "properties": {
        "nodes": {
            "type": "array",
            "maxItems": 2,
            "prefixItems": [
                {
                    "anyOf": [
                        {
                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "postgres-db" },
                                "name": { "const": "PostgreSQL Database" },
                                "node-type": { "const": "database" }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "mysql-db" },
                                "name": { "const": "MySQL Database" },
                                "node-type": { "const": "database" }
                            }
                        }
                    ]
                }
            ]
        }
    }
}
```

### Relationship Options with Decision Points

```json
{
    "relationships": {
        "type": "array",
        "prefixItems": [
            {
                "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                "type": "object",
                "properties": {
                    "unique-id": { "const": "database-choice" },
                    "description": {
                        "const": "Which database does your application use?"
                    },
                    "relationship-type": {
                        "type": "object",
                        "properties": {
                            "options": {
                                "type": "array",
                                "prefixItems": [
                                    {
                                        "oneOf": [
                                            {
                                                "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/decision",
                                                "type": "object",
                                                "properties": {
                                                    "description": {
                                                        "const": "Use PostgreSQL"
                                                    },
                                                    "nodes": {
                                                        "const": ["postgres-db"]
                                                    },
                                                    "relationships": {
                                                        "const": [
                                                            "app-to-postgres"
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/decision",
                                                "type": "object",
                                                "properties": {
                                                    "description": {
                                                        "const": "Use MySQL"
                                                    },
                                                    "nodes": {
                                                        "const": ["mysql-db"]
                                                    },
                                                    "relationships": {
                                                        "const": [
                                                            "app-to-mysql"
                                                        ]
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]
    }
}
```

## Complete Pattern Example

**Conference Signup Pattern (Based on Real Example):**

```json
{
    "$schema": "https://calm.finos.org/release/1.0/meta/calm.json",
    "$id": "https://patterns.company.com/conference-signup.pattern.json",
    "title": "Conference Signup Pattern",
    "description": "A reusable architecture pattern for conference signup systems with Kubernetes deployment",
    "type": "object",
    "properties": {
        "nodes": {
            "type": "array",
            "minItems": 4,
            "maxItems": 4,
            "prefixItems": [
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "frontend" },
                        "name": { "const": "Web Frontend" },
                        "node-type": { "const": "webclient" },
                        "description": {
                            "const": "Conference registration website"
                        },
                        "interfaces": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 1,
                            "prefixItems": [
                                {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/url-interface",
                                    "properties": {
                                        "unique-id": { "const": "frontend-url" }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "api-service" },
                        "name": { "const": "Registration API" },
                        "node-type": { "const": "service" },
                        "description": {
                            "const": "Conference registration API service"
                        },
                        "interfaces": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 2,
                            "prefixItems": [
                                {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/container-image-interface",
                                    "properties": {
                                        "unique-id": { "const": "api-image" }
                                    }
                                },
                                {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/port-interface",
                                    "properties": {
                                        "unique-id": { "const": "api-port" }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "anyOf": [
                        {
                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "postgres-db" },
                                "name": { "const": "PostgreSQL Database" },
                                "node-type": { "const": "database" },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "postgres-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "postgres-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                            "type": "object",
                            "properties": {
                                "unique-id": { "const": "mysql-db" },
                                "name": { "const": "MySQL Database" },
                                "node-type": { "const": "database" },
                                "interfaces": {
                                    "type": "array",
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/container-image-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "mysql-image"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/port-interface",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "mysql-port"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                },
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "k8s-cluster" },
                        "name": { "const": "Kubernetes Cluster" },
                        "node-type": { "const": "system" },
                        "description": {
                            "const": "Kubernetes deployment environment"
                        }
                    }
                }
            ]
        },
        "relationships": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "prefixItems": [
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "frontend-to-api" },
                        "description": {
                            "const": "Frontend calls registration API"
                        },
                        "protocol": { "const": "HTTPS" },
                        "relationship-type": {
                            "const": {
                                "connects": {
                                    "source": { "node": "frontend" },
                                    "destination": { "node": "api-service" }
                                }
                            }
                        }
                    },
                    "required": ["description"]
                },
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                    "type": "object",
                    "properties": {
                        "unique-id": { "const": "api-to-database" },
                        "description": {
                            "const": "API stores registration data"
                        },
                        "protocol": { "const": "JDBC" },
                        "relationship-type": {
                            "const": {
                                "connects": {
                                    "source": { "node": "api-service" },
                                    "destination": { "node": "postgres-db" }
                                }
                            }
                        }
                    },
                    "required": ["description"]
                },
                {
                    "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                    "properties": {
                        "unique-id": { "const": "deployed-in-k8s" },
                        "description": {
                            "const": "Components deployed on Kubernetes"
                        },
                        "relationship-type": {
                            "const": {
                                "deployed-in": {
                                    "container": "k8s-cluster",
                                    "nodes": ["api-service", "postgres-db"]
                                }
                            }
                        }
                    },
                    "required": ["description"]
                }
            ]
        },
        "metadata": {
            "type": "array",
            "minItems": 1,
            "maxItems": 1,
            "prefixItems": [
                {
                    "type": "object",
                    "properties": {
                        "kubernetes": {
                            "type": "object",
                            "properties": {
                                "namespace": { "const": "conference" }
                            },
                            "required": ["namespace"]
                        }
                    },
                    "required": ["kubernetes"]
                }
            ]
        }
    },
    "required": ["nodes", "relationships", "metadata"]
}
```

## Key Pattern Features

Based on real CALM patterns, patterns should include:

### Complete Node Definitions

- **Interfaces**: Define specific interface types (url-interface, container-image-interface, port-interface, etc.)
- **Constraints**: Use `const` for fixed values, `anyOf` for choices
- **Array constraints**: Use `minItems`, `maxItems`, and `prefixItems`

### Detailed Relationships

- **Protocol specification**: Include `protocol` property with values like "HTTPS", "JDBC", "mTLS"
- **Relationship types**: Use `connects` and `deployed-in` appropriately
- **Required fields**: Always include `"required": ["description"]`

### Metadata Constraints

- **Structured metadata**: Define specific metadata schema constraints
- **Deployment information**: Include environment-specific details (e.g., Kubernetes namespace)

### Optional: Controls

Patterns can include security controls on relationships:

```json
"controls": {
    "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/controls",
    "properties": {
        "security": {
            "type": "object",
            "properties": {
                "description": {
                    "const": "Security controls for this connection"
                },
                "requirements": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 1,
                    "prefixItems": [
                        {
                            "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/control-detail",
                            "properties": {
                                "requirement-url": {
                                    "const": "https://schemas.company.com/security/connection-security.json"
                                },
                                "config-url": {
                                    "const": "https://configs.company.com/security/https-config.json"
                                }
                            }
                        }
                    ]
                }
            }
        }
    }
}
```

### Optional: Flows

Patterns can also constrain business flows (though not shown in the basic examples).

## Important Schema Details

### Interface References

Always use specific interface schema references:

- `url-interface` for web endpoints
- `container-image-interface` for Docker images
- `port-interface` for network ports
- `host-port-interface` for host/port combinations

### Relationship Types

- `connects`: For service-to-service communications
- `deployed-in`: For deployment relationships (container/nodes structure)

### Array Handling

- Use `prefixItems` to define specific array positions
- Use `minItems`/`maxItems` to constrain array sizes
- Each array item should reference base schema + add constraints

## Using Patterns with calm generate

Patterns are instantiated using the `calm generate` command:

```bash
# Generate architecture from pattern
calm generate --pattern https://patterns.company.com/conference-signup.pattern.json

# Generate with specific options
calm generate --pattern conference-signup --output my-architecture.json
```

The CLI will prompt for choices when encountering `anyOf`/`oneOf` options, or you can provide a configuration file.

## JSON Schema Constructs Reference

### Constraint Properties

- `const` - Fixed values that cannot be changed
- `enum` - List of allowed values
- `minItems`/`maxItems` - Array size constraints
- `prefixItems` - Define specific array items

### Option Constructs

- `anyOf` - One or more options can be true
- `oneOf` - Exactly one option must be true
- `allOf` - All conditions must be true

### Schema References

- `$ref` - Reference base CALM schema definitions
- Always reference `https://calm.finos.org/release/1.0/meta/core.json#/defs/node` for nodes
- Always reference `https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship` for relationships
- Reference specific interface schemas from `https://calm.finos.org/release/1.0/meta/interface.json#/defs/`

## Validation Rules

1. Pattern must be a valid JSON schema extending CALM architecture schema
2. Must reference base CALM schema: `"$schema": "https://calm.finos.org/release/1.0/meta/calm.json"`
3. Node definitions must use `$ref` to core node schema
4. Relationship definitions must use `$ref` to core relationship schema
5. Use `const` for fixed values, `anyOf`/`oneOf` for options
6. All constraint properties must be valid JSON schema constructs
7. Pattern should be testable with `calm validate --pattern`

## Best Practices

- Create patterns for commonly repeated architecture components
- Use meaningful constraint names and descriptions
- Provide clear choices in `anyOf`/`oneOf` constructs
- Use `const` values for fixed architectural decisions
- Reference external schemas for complex interface definitions
- Test patterns thoroughly before publishing
- Version patterns using semantic versioning in `$id`
- Document pattern usage and options clearly
- Consider composability when designing pattern choices

## Pattern Testing

Test patterns before publishing:

```bash
# Validate pattern schema
calm validate --pattern my-pattern.json

# Generate test architecture from pattern
calm generate --pattern my-pattern.json --output test-arch.json

# Validate generated architecture
calm validate --architecture test-arch.json
```
