# CALM Control Creation Guide

## Critical Requirements

🚨 **ALWAYS call the control creation tool before creating any controls**

## Official JSON Schema Definition

The complete control schema from the FINOS CALM v1.1 specification:

```json
{
    "controls": {
        "type": "object",
        "patternProperties": {
            "^[a-zA-Z0-9-]+$": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "A description of a control and how it applies to a given architecture"
                    },
                    "requirements": {
                        "type": "array",
                        "items": {
                            "$ref": "#/defs/control-detail"
                        }
                    }
                },
                "required": ["description", "requirements"]
            }
        }
    },
    "control-detail": {
        "type": "object",
        "properties": {
            "requirement-url": {
                "type": "string",
                "description": "The requirement schema that specifies how a control should be defined"
            },
            "config-url": {
                "type": "string",
                "description": "The configuration of how the control requirement schema is met"
            },
            "config": {
                "type": "object",
                "description": "Inline configuration of how the control requirement schema is met"
            }
        },
        "required": ["requirement-url"],
        "oneOf": [
            {
                "required": ["config-url"]
            },
            {
                "required": ["config"]
            }
        ]
    }
}
```

## Overview

Controls in CALM represent compliance policies, governance rules, and enforcement mechanisms applied to architecture elements.

## Where Controls Can Be Applied

Controls can be applied at multiple levels within a CALM architecture:

### 1. Architecture Level (Document Root)

Applied to the entire architecture document - affects all components:

```json
{
    "calm-version": "1.1.0",
    "architecture-version": "1.0.0",
    "controls": {
        "data-residency": {
            "description": "All data must remain within EU boundaries",
            "requirements": [
                {
                    "requirement-url": "https://schemas.company.com/compliance/gdpr-residency.json",
                    "config": {
                        "allowed-regions": ["eu-west-1", "eu-central-1"],
                        "data-types": ["personal", "financial"]
                    }
                }
            ]
        }
    },
    "nodes": [...],
    "relationships": [...]
}
```

### 2. Node Level

Applied to specific components or services:

```json
{
    "unique-id": "payment-processor",
    "node-type": "service",
    "name": "Payment Processing Service",
    "controls": {
        "pci-compliance": {
            "description": "PCI-DSS requirements for payment card data processing",
            "requirements": [
                {
                    "requirement-url": "https://schemas.company.com/compliance/pci-dss.json",
                    "config": {
                        "scope": "cardholder-data",
                        "validation-level": "Level-1",
                        "encryption": "end-to-end"
                    }
                }
            ]
        }
    },
    "interfaces": [...]
}
```

### 3. Flow Level

Applied to business processes and data flows:

```json
{
    "unique-id": "trade-settlement-flow",
    "name": "Trade Settlement Process",
    "description": "End-to-end trade settlement workflow",
    "controls": {
        "settlement-compliance": {
            "description": "Regulatory requirements for trade settlement timing and reporting",
            "requirements": [
                {
                    "requirement-url": "https://schemas.company.com/compliance/finra-settlement.json",
                    "config": {
                        "settlement-period": "T+2",
                        "reporting-requirements": ["FINRA", "SEC"],
                        "audit-trail": "complete"
                    }
                }
            ]
        }
    },
    "transitions": [...]
}
```

### 4. Control Inheritance and Scope

- **Architecture-level controls** apply to all nodes, relationships, and flows unless overridden
- **Node-level controls** apply specifically to that component and its interfaces
- **Flow-level controls** apply to the entire business process flow
- **More specific controls override general ones** when there are conflicts
- **Controls are additive** - multiple levels can apply simultaneously

**Example of Control Layering:**

```json
{
    "controls": {
        "base-security": {
            "description": "Organization-wide security baseline",
            "requirements": [...]
        }
    },
    "nodes": [
        {
            "unique-id": "sensitive-service",
            "controls": {
                "enhanced-security": {
                    "description": "Additional security for sensitive data processing",
                    "requirements": [...]
                }
            }
        }
    ]
}
```

## Control Structure

Controls use a modular approach with external schema references:

```json
"controls": {
    "data-protection": {
        "description": "Ensures all sensitive data is properly protected according to compliance requirements",
        "requirements": [
            {
                "requirement-url": "https://schemas.company.com/controls/data-encryption.json",
                "config": {
                    "encryption-algorithm": "AES-256",
                    "key-rotation-period": "90-days",
                    "cipher-modes": ["GCM", "CBC"]
                }
            }
        ]
    },
    "access-control": {
        "description": "Implements role-based access control for all system components",
        "requirements": [
            {
                "requirement-url": "https://schemas.company.com/controls/rbac.json",
                "config-url": "https://configs.company.com/rbac/trading-system.json"
            }
        ]
    }
}
```

## Key Components

### Control Names

Control names use `patternProperties` with regex `^[a-zA-Z0-9-]+$`:

✅ **Valid**: `data-protection`, `access-control`, `audit-logging`
❌ **Invalid**: `data_protection`, `Data Protection`, `access.control`

### Required Properties

Each control MUST have:

- `description` (string) - Describes the control and how it applies
- `requirements` (array) - Array of control-detail objects (minimum 1)

### Control Details (Requirements)

Each requirement MUST have:

- `requirement-url` (string) - Schema defining the control requirement

Each requirement MUST have exactly ONE of:

- `config-url` (string) - External configuration file
- `config` (object) - Inline configuration

## Control Examples

**Security Controls with Inline Configuration:**

```json
"controls": {
    "encryption-in-transit": {
        "description": "All API communications must use TLS 1.3 encryption",
        "requirements": [
            {
                "requirement-url": "https://schemas.company.com/security/tls-encryption.json",
                "config": {
                    "protocol": "TLS",
                    "version": "1.3",
                    "cipher-suites": ["TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"],
                    "certificate-authority": "Internal CA",
                    "cert-rotation": "90-days"
                }
            }
        ]
    }
}
```

**Compliance Controls with External Configuration:**

```json
"controls": {
    "audit-logging": {
        "description": "Comprehensive audit logging for all financial transactions",
        "requirements": [
            {
                "requirement-url": "https://schemas.company.com/compliance/audit-requirements.json",
                "config-url": "https://configs.company.com/audit/trading-system-audit.json"
            }
        ]
    }
}
```

**Multiple Requirements in One Control:**

```json
"controls": {
    "data-governance": {
        "description": "Complete data governance including encryption, retention, and access controls",
        "requirements": [
            {
                "requirement-url": "https://schemas.company.com/data/encryption.json",
                "config": {
                    "algorithm": "AES-256-GCM",
                    "key-management": "HSM-backed"
                }
            },
            {
                "requirement-url": "https://schemas.company.com/data/retention.json",
                "config": {
                    "retention-period": "7-years",
                    "archival-strategy": "cold-storage"
                }
            },
            {
                "requirement-url": "https://schemas.company.com/access/rbac.json",
                "config-url": "https://configs.company.com/rbac/data-access.json"
            }
        ]
    }
}
```

## Validation Rules

1. Control names must match pattern `^[a-zA-Z0-9-]+$` (alphanumeric and hyphens only)
2. Each control must have `description` and `requirements` properties
3. Requirements array must have at least one control-detail object
4. Each control-detail must have `requirement-url`
5. Each control-detail must have either `config-url` OR `config` (not both)
6. Requirement URLs should be accessible schema definitions
7. External config URLs should be accessible configuration files

## Best Practices

- Use descriptive control names that reflect the security domain
- Reference external requirement schemas for consistency
- Use inline config for simple, static configurations
- Use external config-url for complex, environment-specific settings
- Include comprehensive descriptions explaining how controls apply
- Structure requirements to be independently verifiable
- Document the relationship between requirement schemas and configurations
- Regular review and updates for compliance changes
