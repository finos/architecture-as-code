# Day 19: Create an E-Commerce Pattern from Your Architecture

## Overview
Reverse-engineer your e-commerce architecture into a reusable pattern that others can use to generate compliant systems.

## Objective and Rationale
- **Objective:** Create a pattern based on your e-commerce architecture that enforces both structure and Standards
- **Rationale:** Patterns don't always start from scratch - often you have a proven architecture and want to make it reusable. By extracting a pattern from your e-commerce system, you enable teams to generate new instances that follow the same structure and comply with organisational Standards.

## Requirements

### 1. Understand Pattern Extraction

Your e-commerce architecture from Day 7 (updated in Day 17) has:
- Specific nodes (api-gateway, order-service, etc.)
- Specific relationships (connects, interacts, composed-of)
- Standard properties (costCenter, owner, dataClassification)

To make it a pattern, you'll:
- Wrap structural values in `const` (IDs, types, names)
- Include Standard property placeholders
- Keep flexibility where customization is needed

### 2. Review Your E-Commerce Architecture

**Prompt:**
```text
Analyze architectures/ecommerce-platform.json and summarize:

1. How many nodes and what are their unique-ids and types?
2. How many relationships and what types (connects, interacts, composed-of)?
3. What Standard properties does each node have?
4. What Standard properties does each relationship have?
```

### 3. Create the E-Commerce Pattern

**File:** `patterns/ecommerce-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/ecommerce-pattern.json based on architectures/ecommerce-platform.json.

The pattern should:
1. Use the CALM pattern schema
2. Require all the same nodes with their exact unique-ids and node-types using const
3. Require all the same relationships with their exact unique-ids and relationship-types
4. Include Standard property placeholders on every node:
   - costCenter: "CC-0000"
   - owner: "team-name"
   - environment: "development"
5. Include Standard property placeholders on every relationship:
   - dataClassification: "internal"
   - encrypted: true

Use prefixItems with minItems/maxItems to enforce exact structure.
Use const for structural values (unique-id, node-type, relationship-type).
Do not use const for Standard properties - allow customization.
```

### 4. Test Generation

Generate a new architecture from your pattern:

```bash
calm generate -p patterns/ecommerce-pattern.json -o architectures/ecommerce-new.json
```

### 5. Compare Generated vs Original

```bash
# Count nodes
echo "Generated nodes: $(cat architectures/ecommerce-new.json | jq '.nodes | length')"
echo "Original nodes: $(cat architectures/ecommerce-platform.json | jq '.nodes | length')"

# Count relationships  
echo "Generated relationships: $(cat architectures/ecommerce-new.json | jq '.relationships | length')"
echo "Original relationships: $(cat architectures/ecommerce-platform.json | jq '.relationships | length')"
```

The counts should match!

### 6. Validate Both Architectures

Both your original and generated architectures should pass:

```bash
# Original passes
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Generated passes
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-new.json
```

Both should pass! ✅

### 7. Customize the Generated Architecture

The generated architecture has placeholders. For a new team using this pattern, they would customize:

**Prompt:**
```text
Update architectures/ecommerce-new.json to set realistic Standard property values:

- Use different cost centres than the original (CC-5001, CC-5002, etc.)
- Use different owner team names (e.g., "new-orders-team")
- Keep environment as "development" since this is a new instance
```

### 8. Validate Again

```bash
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-new.json
```

Still passes! ✅ The pattern enforces structure, not specific property values.

### 9. Test Structure Enforcement

Try creating an incomplete e-commerce architecture:

```bash
# Create a copy missing a required node
cat architectures/ecommerce-new.json | jq 'del(.nodes[] | select(."unique-id" == "payment-service"))' > /tmp/incomplete.json

# Validate - should fail
calm validate -p patterns/ecommerce-pattern.json -a /tmp/incomplete.json
```

Should fail! ❌ The pattern catches the missing payment-service.

### 10. Visualize Both Versions

Compare the two architectures visually:

1. Open both in VSCode
2. View previews side by side
3. Structure should be identical
4. Property values will differ

### 11. Document the Pattern Extraction

**File:** `patterns/extraction-guide.md`

**Prompt:**
```text
Create patterns/extraction-guide.md documenting:

1. When to extract a pattern from an existing architecture
   - Proven design that should be replicated
   - Need to enforce consistency across teams
   - Want to generate new instances quickly

2. Step-by-step extraction process
   - Identify structural elements (const)
   - Include Standard property placeholders
   - Set counts with minItems/maxItems
   - Test generation and validation

3. What to constrain vs leave flexible
   - Constrain: IDs, types, names, relationships
   - Flexible: Standard property values, interfaces, metadata

4. Testing checklist
   - Generation produces correct structure
   - Original architecture validates
   - Missing nodes/relationships fail validation
```

### 12. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to add documentation for ecommerce-pattern.json:

1. What structure it enforces (all e-commerce nodes and relationships)
2. What Standards it includes
3. How to generate a new e-commerce system
4. How to validate an existing system
5. Comparison with web-app-pattern.json
```

### 13. Clean Up Test Files

```bash
rm architectures/ecommerce-new.json
```

(Or keep it if you want an example of a generated architecture)

### 14. Commit Your Work

```bash
git add patterns/ecommerce-pattern.json patterns/extraction-guide.md patterns/README.md README.md
git commit -m "Day 19: Create e-commerce pattern from existing architecture"
git tag day-19
```

## Deliverables / Validation Criteria

Your Day 19 submission should include a commit tagged `day-19` containing:

✅ **Required Files:**
- `patterns/ecommerce-pattern.json` - E-commerce pattern with Standards
- `patterns/extraction-guide.md` - Pattern extraction documentation
- Updated `patterns/README.md` - Documentation
- Updated `README.md` - Day 19 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/ecommerce-pattern.json

# Original architecture validates against pattern
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Generation works
calm generate -p patterns/ecommerce-pattern.json -o /tmp/test-ecommerce.json

# Check tag
git tag | grep -q "day-19"
```

## Resources

- [JSON Schema const keyword](https://json-schema.org/understanding-json-schema/reference/const)
- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- Your architecture at `architectures/ecommerce-platform.json`

## Tips

- Start by listing all unique-ids and types from your architecture
- Use const for IDs - these are the "contract"
- Include Standard placeholders even though they're not const
- Test by trying to "break" the pattern - missing nodes should fail
- The pattern should be strict on structure, flexible on values

## Pattern Library Summary

You now have:

| Pattern | Purpose | Nodes | Standards |
|---------|---------|-------|-----------|
| company-base-pattern | Enforce Standards only | Any | Required |
| web-app-pattern | 3-tier web app | 3 specific | Required |
| ecommerce-pattern | E-commerce platform | 9 specific | Required |

## Next Steps

Tomorrow (Day 20) is about using these patterns in practice and understanding the complete workflow!
