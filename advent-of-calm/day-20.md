# Day 20: Multi-Pattern Validation for Complete Compliance

## Overview
Learn how to validate a single architecture against multiple patterns - using structural patterns for "what must exist" and standards patterns for "what properties must be present." This approach keeps patterns simple and composable.

## Objective and Rationale
- **Objective:** Update your generated web application architecture to comply with organizational Standards, then validate it against both structural AND standards patterns
- **Rationale:** You don't need complex combined patterns for every situation. Multiple simple patterns validated against a single architecture achieves complete compliance while keeping each pattern focused and reusable. A structural pattern stays simple, a standards pattern stays simple, and together they provide complete governance.

## Requirements

### 1. Review Current State

Your `generated-webapp.json` architecture (created from a pattern in Day 17) has the correct structure but lacks Standard properties. Let's validate it against both patterns:

```bash
# Structural validation - should PASS (architecture has required nodes/relationships)
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Standards validation - should FAIL (architecture doesn't have Standard properties yet)
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

**Key insight:** You can validate an architecture against multiple patterns independently! This means:
- Structural patterns stay focused on "what components must exist"
- Standards patterns stay focused on "what properties must be present"
- You don't need to create complex combined patterns for every architecture type
- Any team's structural pattern automatically inherits company Standards through multi-pattern validation

### 2. Update Node Properties

**Prompt:**
```text
Update architectures/generated-webapp.json to add Standard-compliant properties to ALL nodes.

For each node, add these properties (alongside existing properties like unique-id, name, etc.):
- costCenter: use the values below
- owner: use the team names below  
- environment: "production" for all

Here are the mappings:
- web-frontend: CC-1001, frontend-team
- api-service: CC-2001, backend-team
- app-database: CC-3001, data-team

Keep all existing node properties intact.
```

### 3. Update Relationship Properties

**Prompt:**
```text
Update architectures/generated-webapp.json to add Standard-compliant properties to ALL relationships.

For each relationship, add:
- dataClassification: appropriate level based on data sensitivity
- encrypted: true (all communications should be encrypted)

Use these classifications:
- frontend-to-api: "internal" (browser to API)
- api-to-database: "confidential" (API to database contains sensitive data)

Keep all existing relationship properties intact.
```

### 4. Validate Against Standards Pattern

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

Should now pass! ✅

If you still get errors, check:
- Every node has `costCenter`, `owner`, and `environment`
- Every relationship has `dataClassification` and `encrypted`
- Property names match exactly (case-sensitive)

### 5. Validate Against Both Patterns

Now run both validations to prove complete compliance:

```bash
# Structure check - PASS
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Standards check - PASS  
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

Both pass! ✅✅ Your architecture is now:
- Structurally correct (has required nodes and relationships)
- Standards compliant (has required organizational properties)

### 6. Understand the Power of This Approach

**Why this is better than combined patterns:**

| Approach | Patterns Needed | Maintenance |
|----------|-----------------|-------------|
| Combined patterns | 1 per architecture type × standards | N patterns to update when standards change |
| Multi-pattern validation | 1 structural + 1 standards | Update standards once, applies everywhere |

**Example:** If you have 10 different architecture types and your company updates its Standards:
- **Combined patterns**: Update 10 patterns
- **Multi-pattern validation**: Update 1 standards pattern

### 7. Multi-Pattern Validation in CI/CD

This approach is perfect for automated governance in CI/CD pipelines. Here's how it could work:

**Pipeline Stage: Architecture Compliance**

```yaml
# Example GitHub Actions workflow
architecture-compliance:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Install CALM CLI
      run: npm install -g @finos/calm-cli
    
    - name: Validate Structure
      run: calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
    
    - name: Validate Standards
      run: calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

**Benefits for CI/CD:**
- **Fail fast**: PRs that don't meet structural OR standards requirements are blocked
- **Separation of concerns**: Platform team owns standards pattern, product teams own structural patterns
- **Audit trail**: Git history shows when architectures achieved compliance
- **Scalable governance**: Add new standards checks without modifying existing patterns

**Real-world scenario:**
1. Security team updates `company-base-pattern.json` to require a new `securityClassification` property
2. CI/CD pipelines across ALL projects start failing for non-compliant architectures
3. Teams update their architectures to add the new property
4. No structural patterns needed to change - governance applied universally

### 8. Generate Updated Documentation

```bash
calm docify -a architectures/generated-webapp.json -o docs/webapp
```

Review the generated docs to see how Standard properties appear alongside structural information.

### 9. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to document the multi-pattern validation approach:

1. Explain how structural patterns and standards patterns work together
2. Explain why this is better than combined patterns
3. Describe how this enables CI/CD governance
4. List the current patterns:
   - web-app-pattern.json (structural)
   - company-base-pattern.json (standards)
```

### 10. Update Project README

**Prompt:**
```text
Update README.md to:
1. Mark Day 20 as complete
2. Add section about multi-pattern validation approach
```

### 11. Commit Your Work

```bash
git add architectures/generated-webapp.json patterns/README.md README.md
git commit -m "Day 20: Implement multi-pattern validation for complete compliance"
git tag day-20
```

## Deliverables / Validation Criteria

Your Day 20 submission should include a commit tagged `day-20` containing:

✅ **Required Files:**
- Updated `architectures/generated-webapp.json` - With Standard properties on all nodes and relationships
- Updated `patterns/README.md` - Documenting the multi-pattern approach
- Updated `README.md` - Day 20 marked as complete

✅ **Validation:**
```bash
# Architecture has Standard properties
grep -q "costCenter" architectures/generated-webapp.json
grep -q "dataClassification" architectures/generated-webapp.json

# Structural pattern validates
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Standards pattern validates
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json

# Check tag
git tag | grep -q "day-20"
```

## Resources

- Your Standards in `standards/`
- Your Patterns in `patterns/`
- [CALM Validation Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#validate)

## Tips

- Keep patterns focused on one thing - structure OR standards
- Multi-pattern validation is like applying multiple linters to code
- This approach integrates naturally into CI/CD pipelines
- When standards change, update one pattern - all architectures benefit
- Teams can create their own structural patterns without worrying about standards

## The Multi-Pattern Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Multi-Pattern Validation                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Architecture: generated-webapp.json                                       │
│                                                                             │
│   Validation 1: web-app-pattern.json (Structural)                           │
│   ├── ✓ Has web-frontend node                                               │
│   ├── ✓ Has api-service node                                                │
│   ├── ✓ Has app-database node                                               │
│   └── ✓ Has required relationships                                          │
│                                                                             │
│   Validation 2: company-base-pattern.json (Standards)                       │
│   ├── ✓ All nodes have costCenter                                           │
│   ├── ✓ All nodes have owner                                                │
│   ├── ✓ All nodes have environment                                          │
│   ├── ✓ All relationships have dataClassification                           │
│   └── ✓ All relationships have encrypted                                    │
│                                                                             │
│   Result: FULLY COMPLIANT ✅                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why Multi-Pattern > Combined Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   Scenario: Company has 5 architecture types and updates Standards          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   COMBINED PATTERNS APPROACH:                                               │
│   ├── web-app-pattern.json          ← Update                                │
│   ├── microservice-pattern.json     ← Update                                │
│   ├── event-driven-pattern.json     ← Update                                │
│   ├── batch-processing-pattern.json ← Update                                │
│   └── api-gateway-pattern.json      ← Update                                │
│   = 5 patterns to update 😰                                                 │
│                                                                             │
│   MULTI-PATTERN APPROACH:                                                   │
│   Structural patterns (unchanged):                                          │
│   ├── web-app-pattern.json                                                  │
│   ├── microservice-pattern.json                                             │
│   ├── event-driven-pattern.json                                             │
│   ├── batch-processing-pattern.json                                         │
│   └── api-gateway-pattern.json                                              │
│                                                                             │
│   Standards pattern:                                                        │
│   └── company-base-pattern.json     ← Update ONCE                           │
│   = 1 pattern to update 🎉                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Reflection

- How does separating structural and standards patterns improve maintainability?
- What other types of patterns could you validate independently? (Security? Performance? Cost?)
- How would you integrate multi-pattern validation into a CI/CD pipeline?

## Next Steps

Tomorrow (Day 21) you'll start to put together all that you have learnt in the past twenty days.
