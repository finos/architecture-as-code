---
id: enterprise-architect
title: "Enterprise Architect Challenge"
sidebar_position: 2
---

# Enterprise Architect Challenge

🏆 **Challenge** | 🔴 **Difficulty:** Advanced | ⏱️ **Time:** 60-90 minutes

## Prerequisites

Before starting this challenge, complete these tutorials:

| Tutorial | Why It's Needed |
|----------|-----------------|
| [Beginner Tutorials 1-7](../beginner) | Core CALM modeling skills |
| [Create Patterns](../../how-to/governance/patterns) | How to define reusable patterns |
| [Define Standards](../../how-to/governance/standards) | How standards work as JSON Schema extensions |
| [Multi-Pattern Validation](../../how-to/governance/multi-pattern-validation) | Validating against multiple patterns |

:::tip Stuck?
Each task below includes progressive hints and a reference solution. Start with the task, try hints if stuck, and check the solution only as a last resort.
:::

## Scenario

You are the **Chief Architect** at a growing fintech company. Your mission is to establish architecture governance that enables teams to move fast while maintaining quality and compliance.

## Your Deliverables

1. **Define core architecture patterns** for your organization
2. **Create compliance standards** as JSON Schema extensions
3. **Set up validation workflow** for CI/CD integration
4. **Document key decisions** in ADRs

## Challenge Requirements

### Part 1: Define Core Patterns (30 min)

Create patterns for standard architectures in your organization.

**Task 1.1: Payment Service Pattern**

Create `patterns/payment-service-pattern.json` with:
- Payment API service
- Payment processor
- Audit logging
- Database
- Required security controls

<details>
<summary>💡 Hint 1: Pattern Structure</summary>

Start with the most common architecture. What components does every payment service need?

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/payment-service",
  "nodes": [
    { "unique-id": "{{ SERVICE }}", "node-type": "service" },
    { "unique-id": "{{ SERVICE }}-db", "node-type": "database" },
    { "unique-id": "{{ SERVICE }}-audit", "node-type": "service" }
  ]
}
```
</details>

<details>
<summary>💡 Hint 2: Adding Controls</summary>

Payment services need security controls. Add them to nodes:

```json
{
  "unique-id": "{{ SERVICE }}",
  "node-type": "service",
  "controls": {
    "authentication": { "mechanism": "OAuth2" },
    "encryption": { "at-rest": true, "in-transit": true }
  }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/payment-service",
  "title": "Payment Service Pattern",
  "description": "Standard pattern for payment services",
  "nodes": [
    {
      "unique-id": "payment-api",
      "name": "Payment API",
      "description": "External API for payment operations",
      "node-type": "service",
      "controls": {
        "authentication": { "mechanism": "OAuth2" },
        "encryption": { "in-transit": "TLS1.3" }
      }
    },
    {
      "unique-id": "payment-processor",
      "name": "Payment Processor",
      "description": "Processes payment transactions",
      "node-type": "service"
    },
    {
      "unique-id": "payment-db",
      "name": "Payment Database",
      "description": "Stores payment records",
      "node-type": "database",
      "controls": {
        "encryption": { "at-rest": true }
      }
    },
    {
      "unique-id": "audit-service",
      "name": "Audit Service",
      "description": "Logs all payment operations",
      "node-type": "service"
    }
  ],
  "relationships": [
    {
      "unique-id": "api-to-processor",
      "relationship-type": {
        "connects": {
          "source": { "node": "payment-api" },
          "destination": { "node": "payment-processor" }
        }
      }
    },
    {
      "unique-id": "processor-to-db",
      "relationship-type": {
        "connects": {
          "source": { "node": "payment-processor" },
          "destination": { "node": "payment-db" }
        }
      }
    },
    {
      "unique-id": "processor-to-audit",
      "relationship-type": {
        "connects": {
          "source": { "node": "payment-processor" },
          "destination": { "node": "audit-service" }
        }
      }
    }
  ]
}
```
</details>

**Task 1.2: Data Pipeline Pattern**

Create `patterns/data-pipeline-pattern.json` with:
- Data ingestion service
- Processing service
- Data warehouse
- Audit logging

<details>
<summary>💡 Hint 1: Pipeline Flow</summary>

Think about data flow direction:
1. Ingestion → receives external data
2. Processing → transforms data
3. Warehouse → stores processed data
4. Audit → logs all operations
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/data-pipeline",
  "title": "Data Pipeline Pattern",
  "description": "Standard pattern for data processing pipelines",
  "nodes": [
    {
      "unique-id": "data-ingestion",
      "name": "Data Ingestion Service",
      "node-type": "service"
    },
    {
      "unique-id": "data-processor",
      "name": "Data Processor",
      "node-type": "service"
    },
    {
      "unique-id": "data-warehouse",
      "name": "Data Warehouse",
      "node-type": "database",
      "controls": {
        "encryption": { "at-rest": true }
      }
    },
    {
      "unique-id": "audit-service",
      "name": "Audit Service",
      "node-type": "service"
    }
  ],
  "relationships": [
    {
      "unique-id": "ingestion-to-processor",
      "relationship-type": {
        "connects": {
          "source": { "node": "data-ingestion" },
          "destination": { "node": "data-processor" }
        }
      }
    },
    {
      "unique-id": "processor-to-warehouse",
      "relationship-type": {
        "connects": {
          "source": { "node": "data-processor" },
          "destination": { "node": "data-warehouse" }
        }
      }
    },
    {
      "unique-id": "processor-to-audit",
      "relationship-type": {
        "connects": {
          "source": { "node": "data-processor" },
          "destination": { "node": "audit-service" }
        }
      }
    }
  ]
}
```
</details>

### Part 2: Establish Governance (30 min)

**Task 2.1: Create Compliance Standard**

Create `standards/fintech-compliance.json` as a JSON Schema extension with requirements:
- All services handling financial data must have encryption
- All external APIs must have authentication
- All database access must be audited
- Data retention policies must be documented

<details>
<summary>💡 Hint 1: Standards as JSON Schema</summary>

Standards are JSON Schema extensions using `allOf` with `$ref` to CALM core:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/fintech-compliance",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" }
  ]
}
```
</details>

<details>
<summary>💡 Hint 2: Adding Requirements</summary>

Add property constraints to enforce requirements:

```json
"properties": {
  "nodes": {
    "items": {
      "if": {
        "properties": { "node-type": { "const": "database" } }
      },
      "then": {
        "properties": {
          "controls": {
            "required": ["encryption"]
          }
        }
      }
    }
  }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/fintech-compliance",
  "title": "Fintech Compliance Standard",
  "description": "Organizational standard for financial services compliance",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    {
      "properties": {
        "nodes": {
          "items": {
            "allOf": [
              {
                "if": {
                  "properties": { "node-type": { "const": "database" } }
                },
                "then": {
                  "properties": {
                    "controls": {
                      "type": "object",
                      "required": ["encryption"],
                      "properties": {
                        "encryption": {
                          "properties": {
                            "at-rest": { "const": true }
                          },
                          "required": ["at-rest"]
                        }
                      }
                    }
                  },
                  "required": ["controls"]
                }
              }
            ]
          }
        }
      }
    }
  ]
}
```

See [Define Standards](../../how-to/governance/standards) for more examples.
</details>

**Task 2.2: Create Operational Standard**

Create `standards/operational-requirements.json` with:
- High availability (minimum replicas)
- Disaster recovery (backup requirements)
- Monitoring (required metrics)

<details>
<summary>💡 Hint 1: Operational Controls</summary>

Use the controls structure to capture operational requirements:

```json
"controls": {
  "high-availability": { "min-replicas": 3 },
  "disaster-recovery": { "backup-frequency": "daily" },
  "monitoring": { "metrics": ["cpu", "memory", "latency"] }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/operational-requirements",
  "title": "Operational Requirements Standard",
  "description": "Standard for production operational requirements",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    {
      "properties": {
        "nodes": {
          "items": {
            "if": {
              "properties": { "node-type": { "const": "service" } }
            },
            "then": {
              "properties": {
                "controls": {
                  "type": "object",
                  "properties": {
                    "high-availability": { "type": "object" },
                    "monitoring": { "type": "object" }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]
}
```
</details>

### Part 3: Validation Workflow (20 min)

**Task 3.1: Create Validation Script**

Create a shell script or Makefile that validates architectures against all patterns and standards.

<details>
<summary>💡 Hint 1: Multiple Validations</summary>

CALM doesn't have a built-in "profile" feature. Instead, run multiple validation commands:

```bash
calm validate --architecture arch.json --pattern patterns/pattern1.json
calm validate --architecture arch.json --pattern patterns/pattern2.json
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `scripts/validate-all.sh`:

```bash
#!/bin/bash
set -e

ARCH=$1
echo "Validating $ARCH against all patterns and standards..."

# Validate against structural patterns
calm validate \
  --architecture "$ARCH" \
  --pattern patterns/payment-service-pattern.json

# Validate against compliance standard
calm validate \
  --architecture "$ARCH" \
  --pattern standards/fintech-compliance.json

# Validate against operational standard
calm validate \
  --architecture "$ARCH" \
  --pattern standards/operational-requirements.json

echo "✅ All validations passed!"
```

See [Multi-Pattern Validation](../../how-to/governance/multi-pattern-validation) for advanced workflows.
</details>

**Task 3.2: Create CI/CD Workflow**

Create `.github/workflows/validate.yml` that:
- Validates all architectures on PR
- Generates compliance reports
- Blocks merge if validation fails

<details>
<summary>💡 Hint 1: GitHub Actions Structure</summary>

```yaml
name: Validate Architectures
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install CALM CLI
        run: npm install -g @finos/calm-cli
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```yaml
name: Validate Architectures
on:
  pull_request:
    paths:
      - 'architectures/**'
      - 'patterns/**'
      - 'standards/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install CALM CLI
        run: npm install -g @finos/calm-cli
        
      - name: Validate all architectures
        run: |
          for arch in architectures/*.json; do
            echo "Validating $arch..."
            ./scripts/validate-all.sh "$arch"
          done
          
      - name: Generate compliance report
        run: |
          echo "## Architecture Compliance Report" >> $GITHUB_STEP_SUMMARY
          echo "All architectures validated successfully ✅" >> $GITHUB_STEP_SUMMARY
```
</details>

### Part 4: Document Decisions (10 min)

Create ADRs documenting:
- Why you chose these patterns
- Why you chose these standards
- What trade-offs were considered

<details>
<summary>💡 Hint 1: ADR Structure</summary>

Use the standard ADR format:

```markdown
# ADR-001: Payment Service Pattern

## Status
Accepted

## Context
We need a standard way to build payment services...

## Decision
We will use the Payment Service Pattern...

## Consequences
- Teams get consistency
- Governance is automated
- Some flexibility is lost
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `adrs/001-payment-service-pattern.md`:

```markdown
# ADR-001: Payment Service Pattern

## Status
Accepted

## Context
Our organization is building multiple payment-related services.
Each team was designing their own architecture, leading to:
- Inconsistent security controls
- Varying audit approaches  
- Difficult cross-team debugging

## Decision
We will adopt a standard Payment Service Pattern that includes:
- Mandatory audit service for all payment operations
- Required encryption at rest for payment data
- OAuth2 authentication for all external APIs

## Consequences
### Positive
- Consistent architecture across all payment services
- Automated compliance validation in CI/CD
- Faster onboarding for new team members
- Easier security audits

### Negative
- Less flexibility for teams with unique requirements
- Pattern updates require coordination across teams
- Initial learning curve for existing teams
```

See [Create ADRs](../../how-to/modeling/adrs) for more guidance.
</details>

## Validation Checklist

- [ ] Created at least 2 organizational patterns
- [ ] Defined compliance standards as JSON Schema extensions
- [ ] Created operational standards
- [ ] Set up validation script for multiple patterns
- [ ] CI/CD workflow validates architectures
- [ ] ADRs document key decisions

## Success Criteria

Your solution should:

1. **Enable Consistency** - Teams can create compliant architectures easily
2. **Enforce Governance** - Non-compliant architectures are caught early
3. **Support Audits** - Documentation supports regulatory requirements
4. **Scale** - New teams can onboard quickly

## Hints

<details>
<summary>🆘 Need more help?</summary>

If you're stuck after trying the task-specific hints:

1. **Review the prerequisites** - Make sure you've completed the linked tutorials
2. **Check the Advent of CALM** - Days 17-20 cover patterns, standards, and validation
3. **Ask the community** - [GitHub Discussions](https://github.com/finos/architecture-as-code/discussions)

</details>

## Reflection Questions

1. How would you handle exceptions to standards?
2. How would you version patterns as they evolve?
3. How would you measure adoption across teams?

## Related Guides

- [Create Patterns](../../how-to/governance/patterns)
- [Define Standards](../../how-to/governance/standards)
- [Multi-Pattern Validation](../../how-to/governance/multi-pattern-validation)

## Next Challenge

Continue to [Product Developer Challenge](product-developer) →
