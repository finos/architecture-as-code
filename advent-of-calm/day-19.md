# Day 19: Using Standard Types in a Pattern

## Overview
Combine the power of Standards and Patterns by creating a pattern that references your organisational Standards.

## Objective and Rationale
- **Objective:** Create a pattern that generates architectures with Standard-compliant properties built in
- **Rationale:** Standards define WHAT properties are required. Patterns define WHAT structure is required. Together, they ensure generated architectures are both structurally correct AND organisationally compliant from the start.

## Requirements

### 1. Understand the Power of Combination

**Standards alone:** Validate that properties exist, but don't generate them
**Patterns alone:** Generate structure, but don't enforce organisational properties
**Together:** Generate Standard-compliant architectures that pass all validation

### 2. Review Your Standards

Check what your Standards require:

```bash
cat standards/service-node-standard.json | jq '.required'
cat standards/database-node-standard.json | jq '.required'
```

These are the properties that should be in every generated architecture.

### 3. Create a Standard-Aware Pattern

**File:** `patterns/standard-webapp-pattern.json`

This pattern will generate a web app with all Standard-required properties:

**Prompt:**
```text
Create patterns/standard-webapp-pattern.json that extends web-app-pattern.json to include Standard-compliant properties.

The pattern should:

1. Have the same 3-tier structure (frontend, API, database)

2. For each service node (web-frontend, api-service), include:
   - All core CALM properties (unique-id, node-type, name, description)
   - Standard properties with placeholder values:
     - owner: "team-name"
     - costCenter: "CC-0000"
     - criticality: "medium"
     - environment: "development"

3. For the database node (app-database), include:
   - All core CALM properties
   - Database Standard properties:
     - owner: "dba-team"
     - costCenter: "CC-0000"
     - dataClassification: "internal"
     - encryptionAtRest: true
     - backupSchedule: "daily"

4. For relationships, include:
   - Connection Standard properties:
     - dataClassification: "internal"
     - encrypted: true

The pattern should use const for structural values (IDs, types, names) 
but NOT for Standard properties (so users can customize them).
```

### 4. Generate a Standard-Compliant Architecture

```bash
calm generate -p patterns/standard-webapp-pattern.json -o architectures/standard-webapp.json
```

### 5. Verify Standard Properties

Check that generated architecture has Standard properties:

```bash
cat architectures/standard-webapp.json | jq '.nodes[0] | {owner, costCenter, criticality}'
cat architectures/standard-webapp.json | jq '.nodes[2] | {dataClassification, encryptionAtRest}'
```

You should see the Standard properties with their placeholder values.

### 6. Customize the Generated Architecture

The generated architecture has placeholder values. Update them with real values:

**Prompt:**
```text
Update architectures/standard-webapp.json to replace placeholder values with realistic ones:

For web-frontend:
- owner: "frontend-team"
- costCenter: "CC-1234"
- criticality: "high"
- environment: "production"

For api-service:
- owner: "api-team"
- costCenter: "CC-1235"
- criticality: "critical"
- environment: "production"

For app-database:
- owner: "dba-team"
- costCenter: "CC-1236"
- dataClassification: "confidential"
```

### 7. Validate Against Both Pattern and Standards

The architecture should now pass pattern validation:

```bash
calm validate -p patterns/standard-webapp-pattern.json -a architectures/standard-webapp.json
```

And schema validation:

```bash
calm validate -a architectures/standard-webapp.json
```

Both should pass! ✅

### 8. Compare Generation Approaches

Compare the two patterns:

| Aspect | web-app-pattern | standard-webapp-pattern |
|--------|-----------------|-------------------------|
| Generates structure | ✅ | ✅ |
| Generates Standard props | ❌ | ✅ |
| Compliance-ready | Manual work | Immediate |
| Time to production | Longer | Shorter |

### 9. Create a Template for Common Customizations

**File:** `patterns/customization-guide.md`

**Prompt:**
```text
Create patterns/customization-guide.md that documents:

1. How to customize generated architectures:
   - Which values to update (owner, costCenter, etc.)
   - Which values to keep (unique-id, node-type)

2. Common customization scenarios:
   - Development environment setup
   - Production environment setup
   - Different team ownership

3. Validation checklist after customization
```

### 10. Commit Your Work

```bash
git add patterns/standard-webapp-pattern.json architectures/standard-webapp.json patterns/customization-guide.md README.md
git commit -m "Day 19: Create Standard-aware pattern for compliant architecture generation"
git tag day-19
```

## Deliverables / Validation Criteria

Your Day 19 submission should include a commit tagged `day-19` containing:

✅ **Required Files:**
- `patterns/standard-webapp-pattern.json` - Pattern with Standard properties
- `architectures/standard-webapp.json` - Generated and customized architecture
- `patterns/customization-guide.md` - Customization documentation
- Updated `README.md` - Day 19 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/standard-webapp-pattern.json

# Generated architecture has Standard properties
grep -q "costCenter" architectures/standard-webapp.json
grep -q "criticality" architectures/standard-webapp.json
grep -q "dataClassification" architectures/standard-webapp.json

# Validates
calm validate -a architectures/standard-webapp.json

# Check tag
git tag | grep -q "day-19"
```

## Resources

- [JSON Schema allOf composition](https://json-schema.org/understanding-json-schema/reference/combining#allOf)
- [CALM Standards Documentation](https://calm.finos.org/docs/core-concepts/standards)
- Your Standards in `standards/` directory

## Tips

- Use `const` for structural values that must match exactly
- Leave Standard properties without `const` so they can be customized
- Placeholder values should be obviously placeholder (e.g., "CC-0000")
- Document what needs customization vs what should stay fixed
- Consider creating patterns for different environments (dev, staging, prod)

## The Combined Workflow

1. **Create Standards** - Define organisational requirements
2. **Create Standard-Aware Patterns** - Embed Standards in generation
3. **Generate Architectures** - Instant compliant scaffolds
4. **Customize** - Fill in environment-specific values
5. **Validate** - Ensure pattern and schema compliance

This workflow ensures every new architecture starts compliant and stays compliant.

## Next Steps

Tomorrow (Day 20) you'll learn to reverse-engineer patterns from existing architectures!
