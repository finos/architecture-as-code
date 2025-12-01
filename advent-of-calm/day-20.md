# Day 20: The Complete Standards and Patterns Workflow

## Overview
Consolidate your learning into a complete workflow guide for using Standards and Patterns in your organisation.

## Objective and Rationale
- **Objective:** Create comprehensive documentation for teams to follow when working with CALM Standards and Patterns
- **Rationale:** You've built a complete governance system over Days 15-19. Today you'll document the workflow so other teams can use it effectively.

## Requirements

### 1. Review What You've Built

**Standards (Day 15):**
- `standards/company-node-standard.json` - costCenter, owner, environment
- `standards/company-relationship-standard.json` - dataClassification, encrypted

**Patterns (Days 16-19):**
- `patterns/web-app-pattern.json` - 3-tier web app structure + Standards
- `patterns/company-base-pattern.json` - Standards enforcement only
- `patterns/ecommerce-pattern.json` - E-commerce structure + Standards

**Architectures:**
- `architectures/ecommerce-platform.json` - Complete with Standards
- `architectures/generated-webapp.json` - Complete with Standards

### 2. Understand the Workflow Options

**Option A: Start from a Pattern (New Project)**
```
1. Choose pattern → 2. Generate → 3. Customize → 4. Validate
```

**Option B: Validate Existing Architecture**
```
1. Choose pattern → 2. Validate → 3. Fix issues → 4. Validate again
```

**Option C: Create New Pattern (New Architecture Type)**
```
1. Build architecture → 2. Extract pattern → 3. Test → 4. Share
```

### 3. Create the Workflow Guide

**File:** `docs/architecture-workflow.md`

**Prompt:**
```text
Create docs/architecture-workflow.md with comprehensive workflow documentation:

# Architecture Workflow Guide

## Overview
How to use CALM Standards and Patterns for architecture governance.

## Quick Start

### I want to create a new web application
calm generate -p patterns/web-app-pattern.json -o my-app.json
# Edit my-app.json to fill in Standard property values
calm validate -p patterns/web-app-pattern.json -a my-app.json

### I want to create a new e-commerce platform
calm generate -p patterns/ecommerce-pattern.json -o my-platform.json
# Edit to fill in Standard property values
calm validate -p patterns/ecommerce-pattern.json -a my-platform.json

### I want to validate any architecture against company Standards
calm validate -p patterns/company-base-pattern.json -a my-architecture.json

## Detailed Workflows

### Workflow A: New Project from Pattern
(Step by step with examples)

### Workflow B: Validating Existing Work
(Step by step with examples)

### Workflow C: Creating New Patterns
(Step by step with examples)

## Pattern Reference
(Table of all patterns with descriptions)

## Standard Properties Reference
(What properties are required and why)

## Troubleshooting
(Common validation errors and fixes)
```

### 4. Create a Quick Reference Card

**File:** `docs/quick-reference.md`

**Prompt:**
```text
Create docs/quick-reference.md as a one-page cheat sheet:

# CALM Quick Reference

## Commands
Generate: calm generate -p <pattern> -o <output>
Validate: calm validate -p <pattern> -a <architecture>
Validate schema only: calm validate -a <architecture>

## Available Patterns
| Pattern | Use For | Enforces |
| ------- | ------- | -------- |
| company-base-pattern | Any architecture | Standards only |
| web-app-pattern | 3-tier web apps | Structure + Standards |
| ecommerce-pattern | E-commerce platforms | Structure + Standards |

## Required Node Properties
- costCenter: CC-XXXX (required)
- owner: team name (required)  
- environment: development/staging/production

## Required Relationship Properties
- dataClassification: public/internal/confidential/restricted (required)
- encrypted: true/false (required)

## Common Validation Errors
(List with solutions)
```

### 5. Create a New Team Onboarding Guide

**File:** `docs/onboarding.md`

**Prompt:**
```text
Create docs/onboarding.md for new team members:

# Architecture Onboarding Guide

## Welcome
Introduction to our architecture governance approach.

## What You Need
- CALM CLI installed
- VSCode with CALM extension
- Access to this repository

## Your First Architecture
Step-by-step guide to create and validate your first architecture.

## Understanding Standards
Why we require certain properties and what they mean.

## Getting Help
Where to find documentation, who to ask, etc.
```

### 6. Test the Workflows

Practice each workflow to ensure documentation is accurate:

**Workflow A Test:**
```bash
calm generate -p patterns/web-app-pattern.json -o /tmp/workflow-test.json
# Verify it has placeholder values
cat /tmp/workflow-test.json | jq '.nodes[0].costCenter'
```

**Workflow B Test:**
```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
# Should pass
```

### 7. Create CI/CD Integration Guide

**File:** `docs/ci-cd-integration.md`

**Prompt:**
```text
Create docs/ci-cd-integration.md for automated validation:

# CI/CD Integration

## GitHub Actions Example
Workflow that validates architectures on every PR.

## Pre-commit Hook
Validate before committing.

## Validation in Pipeline
Where to add validation in your CI/CD pipeline.

## Handling Failures
What to do when validation fails in CI.
```

### 8. Update Main README

**Prompt:**
```text
Update the project README.md to include:

1. Quick start section pointing to docs/architecture-workflow.md
2. Link to docs/quick-reference.md
3. Overview of available patterns
4. Link to docs/onboarding.md for new team members
```

### 9. Commit Your Work

```bash
git add docs/ README.md
git commit -m "Day 20: Create complete Standards and Patterns workflow documentation"
git tag day-20
```

## Deliverables / Validation Criteria

Your Day 20 submission should include a commit tagged `day-20` containing:

✅ **Required Files:**
- `docs/architecture-workflow.md` - Complete workflow guide
- `docs/quick-reference.md` - One-page cheat sheet
- `docs/onboarding.md` - New team member guide
- `docs/ci-cd-integration.md` - CI/CD integration guide
- Updated `README.md` - Links to documentation
- Updated `README.md` - Day 20 marked as complete

✅ **Validation:**
```bash
# All docs exist
test -f docs/architecture-workflow.md
test -f docs/quick-reference.md
test -f docs/onboarding.md
test -f docs/ci-cd-integration.md

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
| 16 | First Pattern (web-app, structure only) |
| 17 | Company Base Pattern (Standards enforcement) |
| 18 | E-Commerce Pattern (structure + Standards) |
| 19 | Pattern extraction process |
| 20 | Complete workflow documentation |

**You now have:**
- ✅ Reusable Standards for organisational requirements
- ✅ Multiple Patterns for different use cases
- ✅ Documentation for team adoption
- ✅ CI/CD integration guidance

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    Governance System                         │
├─────────────────────────────────────────────────────────────┤
│  Standards          │  Patterns           │  Documentation  │
│  ─────────          │  ────────           │  ─────────────  │
│  • Node Standard    │  • company-base     │  • Workflow     │
│  • Relationship     │  • web-app          │  • Quick Ref    │
│    Standard         │  • ecommerce        │  • Onboarding   │
│                     │                     │  • CI/CD        │
├─────────────────────────────────────────────────────────────┤
│                    Architectures                             │
│  • ecommerce-platform.json (validated ✓)                    │
│  • generated-webapp.json (validated ✓)                      │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

Week 4 is about community! Starting tomorrow:
- **Day 21**: Join CALM community meetings
- **Day 22**: Contribute to CALM Copilot
- **Day 23**: Explore community contributions
- **Day 24**: Review and celebrate!
