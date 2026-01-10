---
id: controls
title: Define Controls
sidebar_position: 2
---

# How to Define Controls

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Controls capture non-functional requirements (NFRs) in your CALM architecture, such as security, performance, compliance, and reliability requirements. Controls link your architecture to external requirement schemas that define how each control should be implemented.

## When to Use This

Use controls when you need to:
- Document security requirements (authentication, encryption)
- Specify performance targets (latency, throughput)
- Track compliance requirements (PCI-DSS, SOC2, GDPR)
- Define reliability expectations (availability, disaster recovery)
- Link architecture components to organizational control requirements

## Quick Start

Add a `controls` object to any node. Each control has a name (the key), a description, and a `requirements` array that links to external requirement schemas:

```json
{
  "unique-id": "api-gateway",
  "name": "API Gateway",
  "node-type": "service",
  "description": "Public API entry point",
  "controls": {
    "authentication": {
      "description": "All requests must be authenticated via OAuth2",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/oauth2.json",
          "config": {
            "mechanism": "OAuth2",
            "token-type": "JWT"
          }
        }
      ]
    }
  }
}
```

## Understanding the Controls Structure

Controls in CALM use a structured format that separates the **what** (requirement schema) from the **how** (configuration):

```json
{
  "controls": {
    "control-name": {
      "description": "Human-readable description of this control",
      "requirements": [
        {
          "requirement-url": "URL to the requirement schema",
          "config": { }  // OR "config-url": "URL to configuration"
        }
      ]
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Explains what this control means for this component |
| `requirements` | Yes | Array of requirement details |
| `requirement-url` | Yes | URL to the JSON Schema defining the control requirement |
| `config` | One of | Inline configuration satisfying the requirement |
| `config-url` | One of | URL to external configuration file |

## Step-by-Step

### 1. Identify Control Categories

Common control categories:

| Category | Examples |
|----------|----------|
| **Security** | Authentication, authorization, encryption |
| **Performance** | Latency SLA, throughput, resource limits |
| **Compliance** | PCI-DSS, GDPR, SOC2, HIPAA |
| **Reliability** | Availability SLA, backup, DR |
| **Operational** | Monitoring, logging, alerting |

### 2. Add Security Controls

```json
{
  "unique-id": "payment-service",
  "name": "Payment Service",
  "node-type": "service",
  "description": "Processes payment transactions",
  "controls": {
    "authentication": {
      "description": "OAuth2 with JWT tokens required for all endpoints",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/authentication.json",
          "config": {
            "mechanism": "OAuth2",
            "token-type": "JWT",
            "issuer": "https://auth.example.com"
          }
        }
      ]
    },
    "authorization": {
      "description": "Role-based access control for payment operations",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/authorization.json",
          "config": {
            "type": "RBAC",
            "roles": ["payment-admin", "payment-operator"]
          }
        }
      ]
    },
    "encryption-in-transit": {
      "description": "TLS 1.3 required for all connections",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/tls.json",
          "config": {
            "min-version": "1.3",
            "cipher-suites": ["TLS_AES_256_GCM_SHA384"]
          }
        }
      ]
    }
  }
}
```

### 3. Add Database Encryption Controls

```json
{
  "unique-id": "customer-database",
  "name": "Customer Database",
  "node-type": "database",
  "description": "Stores customer records",
  "controls": {
    "encryption-at-rest": {
      "description": "All data encrypted at rest using AES-256",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/encryption-at-rest.json",
          "config": {
            "algorithm": "AES-256",
            "key-management": "AWS-KMS"
          }
        }
      ]
    },
    "backup": {
      "description": "Daily automated backups with 30-day retention",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/backup.json",
          "config": {
            "frequency": "daily",
            "retention-days": 30,
            "encrypted": true
          }
        }
      ]
    }
  }
}
```

### 4. Add Compliance Controls

```json
{
  "unique-id": "payment-processor",
  "name": "Payment Processor",
  "node-type": "service",
  "description": "Handles credit card transactions",
  "controls": {
    "pci-dss": {
      "description": "Service handles cardholder data per PCI-DSS requirements",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/pci-dss.json",
          "config": {
            "level": 1,
            "requirements-met": ["3.4", "6.5", "8.2"]
          }
        }
      ]
    },
    "audit-logging": {
      "description": "All payment operations logged for audit trail",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/audit-logging.json",
          "config": {
            "retention-days": 365,
            "immutable": true
          }
        }
      ]
    }
  }
}
```

### 5. Using External Configuration

For sensitive or complex configurations, reference an external file:

```json
{
  "controls": {
    "authentication": {
      "description": "OAuth2 authentication configuration",
      "requirements": [
        {
          "requirement-url": "https://example.com/controls/oauth2.json",
          "config-url": "https://config.example.com/services/api-gateway/auth-config.json"
        }
      ]
    }
  }
}
```

### 6. Validate Controls

Run the CLI to validate your controls:

```bash
calm validate -a your-architecture.json
```

## Control Schema Reference

### Controls Object Structure

```json
{
  "controls": {
    "<control-name>": {
      "description": "string (required)",
      "requirements": [
        {
          "requirement-url": "string (required)",
          "config": { },      // object - use this OR config-url
          "config-url": ""    // string - use this OR config
        }
      ]
    }
  }
}
```

### Key Rules

1. **Control names** must match pattern `^[a-zA-Z0-9-]+$` (alphanumeric with hyphens)
2. **description** is required for each control
3. **requirements** array is required (can have multiple requirements per control)
4. Each requirement must have **requirement-url**
5. Each requirement must have either **config** OR **config-url** (not both)

## Best Practices

:::tip Use Descriptive Control Names
Use names like `encryption-at-rest`, `authentication`, `audit-logging` that clearly indicate the control's purpose.
:::

:::tip Create Organizational Requirement Schemas
Define standard requirement schemas for your organization (e.g., `https://yourcompany.com/controls/`) so teams use consistent control definitions.
:::

:::tip Be Specific in Descriptions
Instead of "must be secure", specify "OAuth2 authentication with JWT tokens, 1-hour expiry"
:::

:::tip Version Your Requirement URLs
Include versions in requirement URLs (e.g., `/controls/v1/oauth2.json`) to manage schema evolution.
:::

## Related Guides

- [Model Business Flows](flows) - Document how data flows through controlled services
- [Define Standards](../governance/standards) - Create validation rules for controls
- [Create Patterns](../governance/patterns) - Include required controls in architecture patterns
