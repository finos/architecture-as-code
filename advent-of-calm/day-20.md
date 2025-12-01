# Day 20: Reverse-Engineering a Pattern from an Existing Architecture

## Overview
Transform your e-commerce architecture into a reusable pattern that others can use to generate similar systems.

## Objective and Rationale
- **Objective:** Create a pattern based on your e-commerce architecture, then test it by generating and validating new architectures
- **Rationale:** Patterns don't always start from scratch - often you have a proven architecture and want to make it reusable. Learn to reverse-engineer architectures into patterns, enabling teams to share successful designs and enforce consistency.

## Requirements

### 1. Understand Pattern Extraction

Your e-commerce architecture has actual values. To make it a pattern:
- Wrap structural values in `const` (IDs, types, names)
- Keep flexibility where customization is needed (hosts, ports, specific metadata)
- Use `prefixItems` to define the exact structure

**What to constrain:**
- ✅ Structure (IDs, node types, relationship connections)
- ✅ Security defaults (HTTPS protocols, encryption requirements)
- ❌ Deployment details (specific hosts, ports) - let users customize

### 2. Review Your E-Commerce Architecture

Open `architectures/ecommerce-platform.json` from Day 7.

**Prompt:**
```text
Analyze architectures/ecommerce-platform.json and identify:

1. How many nodes does it have and what are their unique-ids?
2. How many relationships and what types?
3. What structure should I preserve in a pattern (IDs, types, connections)?
4. What should I leave flexible for customization (hosts, ports, specific metadata)?
```

### 3. Create the E-Commerce Pattern

**File:** `patterns/ecommerce-platform-pattern.json`

**Prompt:**
```text
Create patterns/ecommerce-platform-pattern.json based on architectures/ecommerce-platform.json

Follow the same pattern structure as web-app-pattern.json but with all the nodes and relationships from my e-commerce architecture.

Preserve as const:
- All unique-ids
- All node-types
- All names
- All relationship-type structures
- All protocols (HTTPS, JDBC, etc.)

Include Standard properties with placeholder values:
- owner, costCenter, criticality for services
- dataClassification, encryptionAtRest for databases
- dataClassification, encrypted for relationships

Set minItems and maxItems to match the exact counts.
Use prefixItems to define the exact structure.
```

### 4. Test Generation

Generate a new architecture from your pattern:

```bash
calm generate -p patterns/ecommerce-platform-pattern.json -o architectures/ecommerce-variation.json
```

### 5. Compare Generated vs Original

```bash
# Count nodes
echo "Generated nodes: $(cat architectures/ecommerce-variation.json | jq '.nodes | length')"
echo "Original nodes: $(cat architectures/ecommerce-platform.json | jq '.nodes | length')"

# Count relationships
echo "Generated relationships: $(cat architectures/ecommerce-variation.json | jq '.relationships | length')"
echo "Original relationships: $(cat architectures/ecommerce-platform.json | jq '.relationships | length')"
```

The counts should match!

### 6. Visualize Both Versions

**Steps:**
1. Open `architectures/ecommerce-platform.json` and view preview - **take screenshot**
2. Open `architectures/ecommerce-variation.json` and view preview - **take screenshot**
3. Compare - structure should be identical

### 7. Validate Both Against the Pattern

```bash
calm validate -p patterns/ecommerce-platform-pattern.json -a architectures/ecommerce-platform.json
calm validate -p patterns/ecommerce-platform-pattern.json -a architectures/ecommerce-variation.json
```

Both should pass! ✅

### 8. Test Compliance Enforcement

Create a "broken" version to prove the pattern catches violations:

**Prompt:**
```text
Create architectures/incomplete-ecommerce.json that:
- Copies the basic structure from ecommerce-platform.json
- Removes the payment-service node
- This should fail pattern validation
```

Validate:
```bash
calm validate -p patterns/ecommerce-platform-pattern.json -a architectures/incomplete-ecommerce.json
```

Should fail! ❌ The pattern detected the missing payment service.

Clean up:
```bash
rm architectures/incomplete-ecommerce.json
rm architectures/ecommerce-variation.json
```

### 9. Document Pattern Extraction Process

**File:** `patterns/extraction-guide.md`

**Prompt:**
```text
Create patterns/extraction-guide.md documenting:

1. When to extract a pattern from an existing architecture
   - Proven design that should be replicated
   - Team wants to enforce consistency
   - Architecture is considered "reference"

2. Step-by-step extraction process
   - Identify structural elements (const)
   - Identify flexible elements (no constraint)
   - Set counts with minItems/maxItems
   - Test generation and validation

3. Common pitfalls
   - Over-constraining (too rigid)
   - Under-constraining (not enough governance)
   - Forgetting to test both generation and validation

4. Checklist for pattern extraction
```

### 10. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to add documentation for ecommerce-platform-pattern.json:

1. What the pattern enforces
2. The required nodes and their purposes
3. The required relationships
4. How to generate from this pattern
5. How to validate against this pattern
6. What flexibility remains
```

### 11. Commit Your Work

```bash
git add patterns/ecommerce-platform-pattern.json patterns/extraction-guide.md patterns/README.md README.md
git commit -m "Day 20: Reverse-engineer e-commerce architecture into reusable pattern"
git tag day-20
```

## Deliverables / Validation Criteria

Your Day 20 submission should include a commit tagged `day-20` containing:

✅ **Required Files:**
- `patterns/ecommerce-platform-pattern.json` - Pattern extracted from architecture
- `patterns/extraction-guide.md` - Pattern extraction documentation
- Updated `patterns/README.md` - Documentation
- Updated `README.md` - Day 20 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/ecommerce-platform-pattern.json

# Original architecture passes pattern
calm validate -p patterns/ecommerce-platform-pattern.json -a architectures/ecommerce-platform.json

# Generation works
calm generate -p patterns/ecommerce-platform-pattern.json -o /tmp/test-ecommerce.json

# Check tag
git tag | grep -q "day-20"
```

## Resources

- [JSON Schema const keyword](https://json-schema.org/understanding-json-schema/reference/const)
- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- [CALM Pattern Examples](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)

## Tips

- Start by listing what makes your architecture unique and required
- Use const for IDs - these are the "contract"
- Leave metadata flexible - implementations will customize
- The pattern should be strict enough to ensure compatibility, flexible enough to be useful
- Test by trying to "break" the pattern - missing nodes, wrong relationships

## Week 3 Recap

Congratulations! You've completed Week 3 and learned:

- ✅ **Day 15**: Understanding CALM Standards
- ✅ **Day 16**: Creating Node and Relationship Standards
- ✅ **Day 17**: Applying Standards to architectures
- ✅ **Day 18**: Creating your first Pattern
- ✅ **Day 19**: Combining Standards with Patterns
- ✅ **Day 20**: Reverse-engineering Patterns from architectures

You now have:
- A library of organisational Standards
- Reusable Patterns for web apps and e-commerce
- Skills to extract patterns from proven architectures
- Understanding of the Standards + Patterns workflow

## Next Steps

Week 4 is about community! Starting tomorrow:
- **Day 21**: Join the CALM community meetings
- **Day 22**: Contribute to CALM Copilot
- **Day 23**: Explore community contributions
- **Day 24**: Review and celebrate!
