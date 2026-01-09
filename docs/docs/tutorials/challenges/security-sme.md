---
id: security-sme
title: "Security SME Challenge"
sidebar_position: 4
---

# Security SME Challenge

🏆 **Challenge** | 🔴 **Difficulty:** Advanced | ⏱️ **Time:** 60-90 minutes

## Prerequisites

Before starting this challenge, complete these tutorials:

| Tutorial | Why It's Needed |
|----------|-----------------|
| [Beginner Tutorials 1-7](../beginner) | Core CALM modeling skills |
| [Define Controls](../../how-to/modeling/controls) | Adding security controls to nodes |
| [Define Standards](../../how-to/governance/standards) | Creating JSON Schema standards |
| [Create Patterns](../../how-to/governance/patterns) | Defining validation patterns |

:::tip Stuck?
Each task below includes progressive hints and a reference solution. Start with the task, try hints if stuck, and check the solution only as a last resort.
:::

## Scenario

You're the **Security Architect** responsible for reviewing all new architectures. Today you need to review a submitted architecture, identify security issues, and create standards to prevent future problems.

## Your Deliverables

1. **Review** a submitted architecture for security issues
2. **Create security standards** as JSON Schema extensions
3. **Build validation patterns** that catch common problems
4. **Provide remediation guidance** for development teams

## Challenge Requirements

### Part 1: Security Review (30 min)

A team has submitted this architecture for review:

```json
{
  "unique-id": "customer-portal",
  "name": "Customer Portal",
  "nodes": [
    {
      "unique-id": "web-frontend",
      "name": "Web Frontend",
      "node-type": "webclient",
      "external": true
    },
    {
      "unique-id": "api-server",
      "name": "API Server",
      "node-type": "service",
      "external": true
    },
    {
      "unique-id": "customer-db",
      "name": "Customer Database",
      "node-type": "database"
    },
    {
      "unique-id": "payment-processor",
      "name": "Payment Processor",
      "node-type": "service"
    }
  ],
  "relationships": [
    {
      "unique-id": "frontend-to-api",
      "relationship-type": {
        "connects": {
          "source": { "node": "web-frontend" },
          "destination": { "node": "api-server" }
        }
      }
    },
    {
      "unique-id": "api-to-db",
      "relationship-type": {
        "connects": {
          "source": { "node": "api-server" },
          "destination": { "node": "customer-db" }
        }
      }
    },
    {
      "unique-id": "api-to-payment",
      "relationship-type": {
        "connects": {
          "source": { "node": "api-server" },
          "destination": { "node": "payment-processor" }
        }
      }
    }
  ]
}
```

**Task 1.1: Identify Security Issues**

Create a review document listing all security concerns:

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| ? | ? | ? | ? |

<details>
<summary>💡 Hint 1: What to Look For</summary>

Common security issues in architectures:
- External services without authentication controls
- Database connections without encryption
- Missing audit logging
- No network segmentation (everything connects to everything)
- Sensitive data without protection
</details>

<details>
<summary>💡 Hint 2: Check the Architecture</summary>

Look at each node and relationship:
- `web-frontend`: External, connects to API - does the API have auth?
- `api-server`: External, connects to DB - is connection encrypted?
- `customer-db`: Stores customer data - is it encrypted at rest?
- `payment-processor`: Handles payments - audit logging?
</details>

<details>
<summary>✅ Reference Solution</summary>

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| No authentication on external API | Critical | api-server | Add OAuth2/JWT authentication control |
| No encryption for database | Critical | customer-db | Add encryption at-rest control |
| No TLS on DB connection | High | api-to-db relationship | Add encryption in-transit |
| No audit logging | High | All components | Add audit service and logging |
| External API server | Medium | api-server | Consider API gateway pattern |
| No network controls | Medium | All relationships | Add network segmentation |
</details>

**Task 1.2: Write Review Feedback**

Create a security review document with:
- Summary
- Critical issues (must fix)
- Recommendations
- Approval status

<details>
<summary>✅ Reference Solution</summary>

Create `reviews/customer-portal-review.md`:

```markdown
# Security Review: Customer Portal

## Summary
The Customer Portal architecture has **critical security gaps** that must be addressed before deployment.

**Recommendation: NOT APPROVED** - Requires remediation

## Critical Issues (Must Fix)

### 1. No Authentication on External API
**Location:** api-server node
**Risk:** Unauthorized access to customer data
**Remediation:** Add OAuth2 authentication control

### 2. Database Not Encrypted
**Location:** customer-db node
**Risk:** Data breach exposure
**Remediation:** Enable encryption at rest

### 3. No Audit Logging
**Location:** All nodes
**Risk:** No forensic capability, compliance violation
**Remediation:** Add audit service with logging

## Recommendations (Should Fix)

- Add network segmentation between frontend and backend
- Consider API gateway for rate limiting
- Add monitoring controls

## Next Steps

1. Development team addresses critical issues
2. Re-submit architecture for review
3. Security team validates remediation
```
</details>

### Part 2: Create Security Standards (30 min)

Create standards as JSON Schema extensions that enforce security requirements.

**Task 2.1: Authentication Standard**

Create `standards/authentication-standard.json`:
- External services must have authentication
- Internal services should use mTLS
- No hardcoded credentials

<details>
<summary>💡 Hint 1: Standard Structure</summary>

Standards are JSON Schema extensions using `allOf`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/authentication",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    { /* your constraints */ }
  ]
}
```
</details>

<details>
<summary>💡 Hint 2: Conditional Constraints</summary>

Use JSON Schema `if/then` to apply rules conditionally:

```json
{
  "if": {
    "properties": {
      "external": { "const": true }
    }
  },
  "then": {
    "properties": {
      "controls": {
        "required": ["authentication"]
      }
    },
    "required": ["controls"]
  }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/authentication",
  "title": "Authentication Standard",
  "description": "Requires authentication controls on external services",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    {
      "properties": {
        "nodes": {
          "items": {
            "if": {
              "properties": {
                "external": { "const": true },
                "node-type": { "const": "service" }
              },
              "required": ["external"]
            },
            "then": {
              "properties": {
                "controls": {
                  "type": "object",
                  "properties": {
                    "authentication": {
                      "type": "object",
                      "properties": {
                        "mechanism": {
                          "type": "string",
                          "enum": ["OAuth2", "JWT", "mTLS", "API-Key"]
                        }
                      },
                      "required": ["mechanism"]
                    }
                  },
                  "required": ["authentication"]
                }
              },
              "required": ["controls"]
            }
          }
        }
      }
    }
  ]
}
```

See [Define Standards](../../how-to/governance/standards) for more examples.
</details>

**Task 2.2: Data Protection Standard**

Create `standards/data-protection-standard.json`:
- Databases must be encrypted at rest
- All connections must use TLS
- Sensitive data must be tagged

<details>
<summary>💡 Hint: Database Encryption</summary>

Target database nodes and require encryption:

```json
{
  "if": {
    "properties": { "node-type": { "const": "database" } }
  },
  "then": {
    "properties": {
      "controls": {
        "properties": {
          "encryption": {
            "properties": { "at-rest": { "const": true } },
            "required": ["at-rest"]
          }
        },
        "required": ["encryption"]
      }
    },
    "required": ["controls"]
  }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/data-protection",
  "title": "Data Protection Standard",
  "description": "Requires encryption for data at rest and in transit",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    {
      "properties": {
        "nodes": {
          "items": {
            "if": {
              "properties": { "node-type": { "const": "database" } }
            },
            "then": {
              "properties": {
                "controls": {
                  "type": "object",
                  "properties": {
                    "encryption": {
                      "type": "object",
                      "properties": {
                        "at-rest": { "const": true }
                      },
                      "required": ["at-rest"]
                    }
                  },
                  "required": ["encryption"]
                }
              },
              "required": ["controls"]
            }
          }
        }
      }
    }
  ]
}
```
</details>

**Task 2.3: Network Security Standard**

Create `standards/network-security-standard.json`:
- Network segmentation requirements
- External exposure limits

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/network-security",
  "title": "Network Security Standard",
  "description": "Requires network segmentation and limits external exposure",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json" },
    {
      "properties": {
        "nodes": {
          "items": {
            "if": {
              "properties": { "node-type": { "const": "database" } }
            },
            "then": {
              "properties": {
                "external": { "const": false }
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

Create a script that validates architectures against all security standards.

<details>
<summary>💡 Hint: Multiple Validations</summary>

Run `calm validate` multiple times, once for each standard:

```bash
calm validate --architecture arch.json --pattern standards/authentication-standard.json
calm validate --architecture arch.json --pattern standards/data-protection-standard.json
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `scripts/security-validate.sh`:

```bash
#!/bin/bash
set -e

ARCH=$1
if [ -z "$ARCH" ]; then
  echo "Usage: ./security-validate.sh <architecture.json>"
  exit 1
fi

echo "🔒 Security Validation: $ARCH"
echo "================================"

echo "Checking authentication standard..."
calm validate \
  --architecture "$ARCH" \
  --pattern standards/authentication-standard.json

echo "Checking data protection standard..."
calm validate \
  --architecture "$ARCH" \
  --pattern standards/data-protection-standard.json

echo "Checking network security standard..."
calm validate \
  --architecture "$ARCH" \
  --pattern standards/network-security-standard.json

echo "✅ All security checks passed!"
```

See [Multi-Pattern Validation](../../how-to/governance/multi-pattern-validation) for CI/CD integration.
</details>

**Task 3.2: Test Against Submission**

```bash
# Save the example architecture as review/submission.json
# Then run validation
calm validate \
  --architecture review/submission.json \
  --pattern standards/authentication-standard.json
```

<details>
<summary>💡 Hint: Expected Failures</summary>

The example architecture should fail validation because:
- `api-server` is external but has no authentication control
- `customer-db` has no encryption control

This proves your standards are working!
</details>

### Part 4: Remediation Guidance (10 min)

Create a remediation guide showing how to fix common issues.

<details>
<summary>💡 Hint: Before/After Examples</summary>

Show developers exactly what to change:

**Before (failing):**
```json
{ "unique-id": "api-server", "node-type": "service", "external": true }
```

**After (passing):**
```json
{
  "unique-id": "api-server",
  "node-type": "service",
  "external": true,
  "controls": {
    "authentication": { "mechanism": "OAuth2" }
  }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `docs/security-remediation-guide.md` with before/after examples for each security issue:

**Authentication fix:**

Before:
```json
{ "unique-id": "api-server", "node-type": "service", "external": true }
```

After:
```json
{
  "unique-id": "api-server",
  "node-type": "service",
  "external": true,
  "controls": {
    "authentication": { "mechanism": "OAuth2" }
  }
}
```

**Data protection fix:**

Before:
```json
{ "unique-id": "customer-db", "node-type": "database" }
```

After:
```json
{
  "unique-id": "customer-db",
  "node-type": "database",
  "controls": {
    "encryption": { "at-rest": true }
  }
}
```

Include guidance on allowed authentication mechanisms (OAuth2, JWT, mTLS, API-Key) and links to [Define Controls](../../how-to/modeling/controls) for more details.

</details>

## Validation Checklist

- [ ] Identified all security issues in submission
- [ ] Created authentication standard (JSON Schema)
- [ ] Created data protection standard (JSON Schema)
- [ ] Created network security standard (JSON Schema)
- [ ] Security validation script created
- [ ] Remediation guidance documented

## Success Criteria

Your solution should:

1. **Be Comprehensive** - Catch common security issues automatically
2. **Be Actionable** - Teams know exactly how to fix issues
3. **Be Automated** - Validation can run in CI/CD
4. **Be Educational** - Help teams learn security best practices

## Security Review Checklist

### Authentication
- [ ] External APIs have authentication
- [ ] Service-to-service uses mTLS
- [ ] No anonymous access to sensitive data

### Encryption
- [ ] Data encrypted at rest
- [ ] TLS for all network traffic
- [ ] Secrets in vault, not config

### Network
- [ ] Minimum external exposure
- [ ] Internal services not public
- [ ] Network segmentation in place

### Logging
- [ ] Security events logged
- [ ] Audit trail for data access
- [ ] Log data protected

## Hints

<details>
<summary>🆘 Need more help?</summary>

If you're stuck after trying the task-specific hints:

1. **Review the prerequisites** - Make sure you've completed the linked tutorials
2. **Check the Advent of CALM** - Days 17-20 cover patterns and standards
3. **Ask the community** - [GitHub Discussions](https://github.com/finos/architecture-as-code/discussions)

</details>

<details>
<summary>💡 Common Issues to Find in the Architecture</summary>

Look for:
- External services without authentication controls
- Database nodes without encryption
- Missing TLS on connections
- No network segmentation
- No audit logging
</details>

## Reflection Questions

1. What security issues are hardest to catch automatically?
2. How would you handle legacy systems that can't meet standards?
3. How do you balance security with developer experience?

## Related Guides

- [Define Controls](../../how-to/modeling/controls)
- [Define Standards](../../how-to/governance/standards)
- [AI Architecture Advisor](../../how-to/documentation/ai-advisor)

## Final Challenge

Complete your journey with [Mastering CALM](mastering-calm) →
