---
id: multi-pattern-validation
title: Multi-Pattern Validation
sidebar_position: 5
---

# How to Validate Against Multiple Standards

Validate complex architectures against multiple patterns and standards simultaneously for comprehensive governance.

## When to Use This

Use multi-standard validation when you need to:
- Apply multiple standard categories (security, naming, docs)
- Validate against pattern compliance
- Create environment-specific profiles (dev, prod)
- Integrate comprehensive checks into CI/CD

## Quick Start

```bash
calm validate \
  --architecture my-architecture.json \
  --standard standards/naming.json \
  --standard standards/security.json \
  --standard standards/documentation.json
```

## Step-by-Step

### 1. Create a Validation Profile

Bundle multiple standards into a profile:

**File:** `validation/production-profile.json`

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/validation-profile.json",
  "unique-id": "production-profile",
  "name": "Production Validation Profile",
  "description": "All standards required for production deployment",
  "standards": [
    {
      "ref": "../standards/naming-standard.json",
      "required": true
    },
    {
      "ref": "../standards/security-standard.json",
      "required": true
    },
    {
      "ref": "../standards/documentation-standard.json",
      "required": true
    }
  ],
  "patterns": [
    {
      "ref": "../patterns/microservice-pattern.json",
      "required": false,
      "condition": "isMicroservice"
    }
  ],
  "settings": {
    "failOnWarning": false,
    "failOnError": true,
    "reportFormat": "detailed"
  }
}
```

### 2. Create Environment-Specific Profiles

**Development Profile:**

```json
{
  "unique-id": "development-profile",
  "name": "Development Profile",
  "standards": [
    { "ref": "../standards/naming-standard.json", "required": true },
    { "ref": "../standards/security-standard.json", "required": false }
  ],
  "settings": {
    "failOnWarning": false,
    "failOnError": false
  }
}
```

**Production Profile:**

```json
{
  "unique-id": "production-profile",
  "name": "Production Profile",
  "standards": [
    { "ref": "../standards/naming-standard.json", "required": true },
    { "ref": "../standards/security-standard.json", "required": true },
    { "ref": "../standards/compliance-standard.json", "required": true }
  ],
  "settings": {
    "failOnWarning": true,
    "failOnError": true
  }
}
```

### 3. Run Profile Validation

```bash
# Using profile
calm validate \
  --architecture architectures/my-service.json \
  --profile validation/production-profile.json

# Using multiple standards directly
calm validate \
  --architecture architectures/my-service.json \
  --standard standards/naming.json \
  --standard standards/security.json \
  --pattern patterns/microservice.json
```

### 4. Review Results

```
╔════════════════════════════════════════════════════════╗
║  Validation Report: my-service.json                    ║
╠════════════════════════════════════════════════════════╣
║  Profile: production-profile                           ║
║  Total Requirements: 15                                ║
║  Passed: 13 | Failed: 1 | Warnings: 1                  ║
╚════════════════════════════════════════════════════════╝

Standards Results:
─────────────────
✓ naming-standard (4/4 passed)
✗ security-standard (3/4 passed)
  ✗ SEC-002: Database connections must use TLS
⚠ documentation-standard (5/6 passed)
  ⚠ DOC-003: Node description too short

Pattern Compliance:
───────────────────
✓ microservice-pattern: Compliant

Status: FAILED
Fix SEC-002 to pass production validation.
```

### 5. Integrate with CI/CD

**GitHub Actions:**

```yaml
name: Architecture Validation

on:
  push:
    paths: ['architectures/**']
  pull_request:
    paths: ['architectures/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install CALM CLI
        run: npm install -g @finos/calm-cli
      
      - name: Validate Architectures
        run: |
          for arch in architectures/*.json; do
            echo "Validating $arch..."
            calm validate \
              --architecture "$arch" \
              --profile validation/production-profile.json
          done
```

**GitLab CI:**

```yaml
validate:
  image: node:20
  script:
    - npm install -g @finos/calm-cli
    - |
      for arch in architectures/*.json; do
        calm validate \
          --architecture "$arch" \
          --profile validation/production-profile.json
      done
  only:
    changes:
      - architectures/**
```

### 6. Generate Validation Report

```bash
calm validate \
  --architecture architectures/my-service.json \
  --profile validation/production-profile.json \
  --output-format json \
  --output validation-report.json
```

## Profile Options

### Standard Configuration

```json
{
  "standards": [
    {
      "ref": "../standards/security.json",
      "required": true,           // Must pass
      "severity-override": "warning"  // Downgrade errors to warnings
    }
  ]
}
```

### Conditional Standards

Apply standards based on architecture characteristics:

```json
{
  "standards": [
    {
      "ref": "../standards/gateway-standard.json",
      "condition": "hasGateway",
      "required": false
    },
    {
      "ref": "../standards/pci-standard.json",
      "condition": "handlesPayments",
      "required": true
    }
  ]
}
```

### Settings

```json
{
  "settings": {
    "failOnError": true,      // Fail on any error
    "failOnWarning": false,   // Don't fail on warnings
    "reportFormat": "detailed", // detailed | summary | json
    "stopOnFirstFailure": false
  }
}
```

## Best Practices

:::tip Environment Profiles
Create separate profiles for dev, staging, and production
:::

:::tip Start Permissive
Begin with warnings, promote to errors as teams adapt
:::

:::tip CI/CD Integration
Validate all architecture changes before merge
:::

:::tip Report History
Save validation reports for audit trails
:::

## Related Guides

- [Create Patterns](patterns) - Define architecture patterns
- [Define Standards](standards) - Create validation rules
- [Standards from Patterns](standards-from-patterns) - Auto-generate standards
