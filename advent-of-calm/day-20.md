# Day 20: The Complete Standards and Patterns Workflow

## Overview
Consolidate your learning by understanding the complete workflow from Standards to Patterns to Architectures.

## Objective and Rationale
- **Objective:** Review and practice the complete governance workflow you've built over the past week
- **Rationale:** You've created Standards, a Base Pattern, and Specific Patterns. Today you'll see how they all work together and practice the workflow that teams would use day-to-day.

## Requirements

### 1. Review What You've Built

Over Days 15-19, you created a complete governance system:

**Standards (Day 15):**
- `standards/company-node-standard.json` - costCenter, owner, environment
- `standards/company-relationship-standard.json` - dataClassification, encrypted

**Patterns (Days 16, 18, 19):**
- `patterns/company-base-pattern.json` - Enforces Standards on any architecture
- `patterns/web-app-pattern.json` - 3-tier web app with Standards
- `patterns/ecommerce-pattern.json` - E-commerce platform with Standards

**Compliant Architectures (Day 17):**
- `architectures/ecommerce-platform.json` - Updated with Standard properties

### 2. Understand the Workflow

**For a new architecture project:**

```
1. Choose a Pattern
   └── "I'm building a web app" → web-app-pattern.json
   └── "I'm building e-commerce" → ecommerce-pattern.json
   └── "I'm building something else" → company-base-pattern.json

2. Generate Scaffold
   └── calm generate -p patterns/chosen-pattern.json -o my-architecture.json

3. Customize
   └── Fill in Standard property values (costCenter, owner, etc.)
   └── Add interfaces, metadata, flows as needed

4. Validate
   └── calm validate -p patterns/chosen-pattern.json -a my-architecture.json

5. Commit & CI/CD
   └── Validation runs in CI to catch regressions
```

### 3. Practice: Create a New E-Commerce Instance

Imagine a new team wants to build their own e-commerce platform:

```bash
# Generate from pattern
calm generate -p patterns/ecommerce-pattern.json -o architectures/ecommerce-team-b.json
```

**Prompt:**
```text
Update architectures/ecommerce-team-b.json with Team B's specific values:

- All nodes: costCenter "CC-7001", owner "team-b", environment "development"
- Relationships: keep dataClassification as generated, encrypted: true

This represents a new team using the same architecture pattern but with their own ownership.
```

### 4. Validate Team B's Architecture

```bash
# Validates against specific pattern
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-team-b.json

# Also validates against base pattern (because it has Standards)
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-team-b.json
```

Both should pass! ✅

### 5. Practice: Create a New Web App

Another team is building a simple web app:

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/webapp-team-c.json
```

**Prompt:**
```text
Update architectures/webapp-team-c.json with Team C's values:

- web-frontend: costCenter "CC-8001", owner "frontend-team-c", environment "staging"
- api-service: costCenter "CC-8002", owner "api-team-c", environment "staging"
- app-database: costCenter "CC-8003", owner "data-team-c", environment "staging"
- All relationships: dataClassification "internal", encrypted true
```

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/webapp-team-c.json
```

### 6. Demonstrate Cross-Team Consistency

Even though Team B and Team C built different systems, they share:
- Same Standard properties (costCenter, owner, environment)
- Same relationship security requirements (dataClassification, encrypted)
- Same validation approach

This is the power of Standards + Patterns!

### 7. Create a Workflow Guide

**File:** `docs/architecture-workflow.md`

**Prompt:**
```text
Create docs/architecture-workflow.md documenting the complete workflow:

1. Before You Start
   - Understand available patterns
   - Check if a pattern exists for your architecture type

2. Generate Your Architecture
   - Choose pattern: base, web-app, or ecommerce
   - Run: calm generate -p pattern.json -o my-arch.json

3. Customize Your Architecture
   - Fill in Standard properties with your team's values
   - Add interfaces for your specific deployment
   - Add any additional metadata

4. Validate Your Architecture
   - Run: calm validate -p pattern.json -a my-arch.json
   - Fix any validation errors

5. Continuous Validation
   - Add validation to CI/CD pipeline
   - Validate on every PR

6. Pattern Reference
   - company-base-pattern.json: Use for non-standard architectures
   - web-app-pattern.json: Use for 3-tier web applications
   - ecommerce-pattern.json: Use for e-commerce platforms
```

### 8. Create a Quick Reference Card

**File:** `docs/quick-reference.md`

**Prompt:**
```text
Create docs/quick-reference.md as a one-page cheat sheet:

# CALM Quick Reference

## Generate Architecture
calm generate -p patterns/<pattern>.json -o architectures/<name>.json

## Validate Architecture  
calm validate -p patterns/<pattern>.json -a architectures/<name>.json
calm validate -a architectures/<name>.json  # Schema only

## Available Patterns
| Pattern | Use For |
|---------|---------|
| company-base-pattern | Any architecture (Standards only) |
| web-app-pattern | 3-tier web applications |
| ecommerce-pattern | E-commerce platforms |

## Required Standard Properties
### Nodes
- costCenter: CC-XXXX
- owner: team-name
- environment: development/staging/production

### Relationships
- dataClassification: public/internal/confidential/restricted
- encrypted: true/false

## Getting Help
- Docs: https://calm.finos.org
- Issues: https://github.com/finos/architecture-as-code/issues
```

### 9. Clean Up Test Architectures

```bash
rm architectures/ecommerce-team-b.json architectures/webapp-team-c.json
```

(These were just for practice)

### 10. Commit Your Work

```bash
git add docs/architecture-workflow.md docs/quick-reference.md README.md
git commit -m "Day 20: Document complete Standards and Patterns workflow"
git tag day-20
```

## Deliverables / Validation Criteria

Your Day 20 submission should include a commit tagged `day-20` containing:

✅ **Required Files:**
- `docs/architecture-workflow.md` - Complete workflow documentation
- `docs/quick-reference.md` - Quick reference card
- Updated `README.md` - Day 20 marked as complete

✅ **Validation:**
```bash
# Documentation exists
test -f docs/architecture-workflow.md
test -f docs/quick-reference.md

# All patterns still work
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-20"
```

## Week 3 Recap

Congratulations! You've built a complete governance system:

| Day | What You Built |
|-----|----------------|
| 15 | Node and Relationship Standards |
| 16 | Company Base Pattern (enforces Standards) |
| 17 | Applied Standards to e-commerce architecture |
| 18 | Web App Pattern (structure + Standards) |
| 19 | E-Commerce Pattern (extracted from architecture) |
| 20 | Workflow documentation |

**You now have:**
- ✅ Reusable Standards for organisational requirements
- ✅ Base Pattern for Standards enforcement
- ✅ Specific Patterns for common architectures
- ✅ Documented workflow for teams to follow
- ✅ Quick reference for daily use

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    CALM Governance System                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Standards (what properties)                                │
│  ├── company-node-standard.json                            │
│  └── company-relationship-standard.json                    │
│           │                                                 │
│           ▼                                                 │
│  Patterns (what structure + enforce standards)             │
│  ├── company-base-pattern.json (generic)                   │
│  ├── web-app-pattern.json (3-tier)                         │
│  └── ecommerce-pattern.json (e-commerce)                   │
│           │                                                 │
│           ▼                                                 │
│  Architectures (actual systems)                            │
│  ├── ecommerce-platform.json                               │
│  └── generated-webapp.json                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

Week 4 is about community! Starting tomorrow:
- **Day 21**: Join CALM community meetings
- **Day 22**: Contribute to CALM Copilot
- **Day 23**: Explore community contributions
- **Day 24**: Review and celebrate!
