---
id: security-sme
title: "Security SME Challenge"
sidebar_position: 4
---

# Security SME Challenge

🏆 **Challenge** | 🔴 **Difficulty:** Advanced | ⏱️ **Time:** 60-90 minutes

## Scenario

You're the **Security Architect** responsible for reviewing all new architectures. Today you need to review a submitted architecture, identify security issues, and create standards to prevent future problems.

## Your Deliverables

1. **Review** a submitted architecture for security issues
2. **Create security standards** for the organization
3. **Build validation rules** that catch common problems
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

**Task 1.2: Write Review Feedback**

Create a security review document with:
- Summary
- Critical issues (must fix)
- Recommendations
- Approval status

### Part 2: Create Security Standards (30 min)

**Task 2.1: Authentication Standard**

Create `standards/authentication-standard.json`:
- External services must have authentication
- Internal services must use service mesh or mTLS
- No hardcoded credentials

**Task 2.2: Data Protection Standard**

Create `standards/data-protection-standard.json`:
- PII must be encrypted at rest
- All database connections must use TLS
- Sensitive data must be tagged

**Task 2.3: Network Security Standard**

Create `standards/network-security-standard.json`:
- Network segmentation requirements
- Firewall rules
- External exposure limits

### Part 3: Validation Rules (20 min)

**Task 3.1: Create Security Profile**

Create `validation/security-profile.json` bundling all security standards.

**Task 3.2: Test Against Submission**

```bash
calm validate \
  --architecture review/submission.json \
  --profile validation/security-profile.json
```

### Part 4: Remediation Guidance (10 min)

Create a remediation guide showing how to fix common issues:

**Example: Adding Authentication**

Before:
```json
{ "unique-id": "api-server", "node-type": "service" }
```

After:
```json
{
  "unique-id": "api-server",
  "node-type": "service",
  "controls": [
    { "type": "authentication", "mechanism": "OAuth2" }
  ]
}
```

## Validation Checklist

- [ ] Identified all security issues in submission
- [ ] Created authentication standard
- [ ] Created data protection standard
- [ ] Created network security standard
- [ ] Security validation profile created
- [ ] Remediation guidance documented

## Success Criteria

Your solution should:

1. **Be Comprehensive** - Catch common security issues
2. **Be Actionable** - Teams know how to fix issues
3. **Be Automated** - Validation runs in CI/CD
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
<summary>Hint 1: Common Issues to Find</summary>

Look for:
- External services without authentication
- Database connections without TLS
- Missing encryption controls
- No network segmentation
- No audit logging
</details>

<details>
<summary>Hint 2: Standard Structure</summary>

```json
{
  "requirements": [
    {
      "id": "AUTH-001",
      "description": "External services must authenticate",
      "severity": "error",
      "validation": {
        "type": "object",
        "properties": {
          "nodes": {
            "items": {
              "if": { "properties": { "external": { "const": true } } },
              "then": { "required": ["controls"] }
            }
          }
        }
      }
    }
  ]
}
```
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
