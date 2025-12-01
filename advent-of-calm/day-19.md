# Day 19: Extracting Patterns from Existing Architectures

## Overview
Learn how to reverse-engineer a pattern from an existing, proven architecture.

## Objective and Rationale
- **Objective:** Extract a reusable pattern from your e-commerce architecture that others can use
- **Rationale:** Patterns don't always start from scratch. Often you have a successful architecture and want to make it a template for others. Learning to extract patterns from existing work lets you scale proven designs across your organisation.

## Requirements

### 1. Understand Pattern Extraction

**When to Extract a Pattern:**
- You have an architecture that works well
- Other teams want to build similar systems
- You want to enforce this structure as a standard

**The Process:**
1. Identify structural elements (nodes, relationships)
2. Decide what to constrain (IDs, types) vs leave flexible (metadata values)
3. Add Standard property requirements
4. Test generation and validation

### 2. Analyze Your E-Commerce Architecture

**Prompt:**
```text
Analyze architectures/ecommerce-platform.json and create a summary:

1. List all nodes with their unique-id and node-type
2. List all relationships with their unique-id and type (connects/interacts/composed-of)
3. What Standard properties does each node have?
4. What Standard properties does each relationship have?

This will be the basis for our extracted pattern.
```

### 3. Decide What to Constrain

**Constrain (use const):**
- `unique-id` - These are the contract
- `node-type` - Must be correct type
- `name` - Consistent naming

**Leave Flexible:**
- `description` - Teams can customize
- Standard property values (costCenter, owner) - Different per team
- Interfaces - Deployment-specific
- Additional metadata

### 4. Create the Extracted Pattern

If you created ecommerce-pattern.json on Day 18, compare it with your architecture:

**Prompt:**
```text
Compare patterns/ecommerce-pattern.json with architectures/ecommerce-platform.json:

1. Does the pattern include all nodes from the architecture?
2. Does the pattern include all relationships?
3. Are there any nodes/relationships in the architecture not in the pattern?
4. Update the pattern to match the complete architecture structure if needed.
```

### 5. Test Round-Trip: Architecture → Pattern → Architecture

The ultimate test: can you generate an architecture from the pattern that matches the original?

```bash
# Generate from pattern
calm generate -p patterns/ecommerce-pattern.json -o /tmp/roundtrip-test.json

# Compare structure
echo "Original nodes: $(jq '.nodes | length' architectures/ecommerce-platform.json)"
echo "Generated nodes: $(jq '.nodes | length' /tmp/roundtrip-test.json)"

echo "Original relationships: $(jq '.relationships | length' architectures/ecommerce-platform.json)"
echo "Generated relationships: $(jq '.relationships | length' /tmp/roundtrip-test.json)"
```

### 6. Validate Both Directions

```bash
# Original validates against pattern
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Generated validates against pattern
calm validate -p patterns/ecommerce-pattern.json -a /tmp/roundtrip-test.json
```

Both should pass! ✅

### 7. Document the Extraction Process

**File:** `patterns/extraction-guide.md`

**Prompt:**
```text
Create patterns/extraction-guide.md documenting how to extract patterns:

1. When to Extract a Pattern
   - Proven architecture that should be replicated
   - Need consistency across teams
   - Want to enforce specific structure

2. Step-by-Step Process
   - List all nodes and relationships
   - Identify structural elements (const)
   - Include Standard property placeholders
   - Set counts with minItems/maxItems
   - Test generation and validation

3. What to Constrain vs Leave Flexible
   - Constrain: IDs, types, names, relationship structure
   - Flexible: descriptions, Standard values, interfaces, metadata

4. Testing Checklist
   - Original architecture validates ✓
   - Generated architecture validates ✓
   - Missing required node fails validation ✓
   - Missing Standard property fails validation ✓
```

### 8. Create a Pattern for Another Architecture

Practice extraction with your web-app architecture:

**Prompt:**
```text
Review architectures/generated-webapp.json (from Day 16).

Update patterns/web-app-pattern.json to include Standard property requirements:
- Each node should require costCenter, owner, environment
- Each relationship should require dataClassification, encrypted

This upgrades the simple structure pattern to a full governance pattern.
```

### 9. Test the Updated Web App Pattern

```bash
# Should fail - generated-webapp.json doesn't have Standard properties yet
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

**Prompt:**
```text
Update architectures/generated-webapp.json to add Standard properties:

Nodes:
- web-frontend: CC-4001, frontend-team, production
- api-service: CC-4002, api-team, production
- app-database: CC-4003, data-team, production

Relationships:
- All: encrypted true, dataClassification "internal"
```

```bash
# Now should pass
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

### 10. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to include:

1. Summary of all patterns and their purposes
2. The extraction process overview
3. Link to extraction-guide.md for details
4. Pattern comparison table
```

### 11. Commit Your Work

```bash
git add patterns/ architectures/generated-webapp.json README.md
git commit -m "Day 19: Document pattern extraction and update patterns with Standards"
git tag day-19
```

## Deliverables / Validation Criteria

Your Day 19 submission should include a commit tagged `day-19` containing:

✅ **Required Files:**
- `patterns/extraction-guide.md` - Pattern extraction documentation
- Updated `patterns/web-app-pattern.json` - Now with Standard requirements
- Updated `architectures/generated-webapp.json` - With Standard properties
- Updated `patterns/README.md` - Complete pattern documentation
- Updated `README.md` - Day 19 marked as complete

✅ **Validation:**
```bash
# Extraction guide exists
test -f patterns/extraction-guide.md

# E-commerce pattern validates architecture
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Web-app pattern validates architecture
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Check tag
git tag | grep -q "day-19"
```

## Resources

- Your architectures in `architectures/`
- Your patterns in `patterns/`
- Your Standards in `standards/`

## Tips

- Start with the nodes - they're easier to identify
- Don't forget composed-of relationships for system containers
- Test incrementally - add one node at a time to the pattern
- If validation fails, check the error message carefully

## Pattern Extraction Checklist

- [ ] List all nodes with unique-id and node-type
- [ ] List all relationships with unique-id and type
- [ ] Create prefixItems for each node
- [ ] Use const for unique-id, node-type, name
- [ ] Include Standard properties without const
- [ ] Create prefixItems for each relationship
- [ ] Set minItems/maxItems to match counts
- [ ] Test: original architecture validates
- [ ] Test: generated architecture validates
- [ ] Test: missing node fails validation
- [ ] Document the pattern

## Next Steps

Tomorrow (Day 20) you'll consolidate everything into a complete workflow guide for your team!
