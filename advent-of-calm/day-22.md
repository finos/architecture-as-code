# Day 22: Create a Migration from Existing Documentation

## Overview
Convert existing architecture documentation (diagrams, wikis, spreadsheets) into CALM format.

## Objective and Rationale
- **Objective:** Take a piece of existing architecture documentation and migrate it to CALM
- **Rationale:** Most teams have existing docs in various formats (Confluence, draw.io, Excel, C4 diagrams). Migration to CALM centralizes knowledge and makes it machine-readable. This is a real-world scenario for CALM adoption.

## Requirements

### 1. Choose Documentation to Migrate

Select existing documentation:
- **Option A:** Architecture diagram (draw.io, Visio, Lucidchart, PlantUML)
- **Option B:** Wiki page (Confluence, GitHub wiki, Notion)
- **Option C:** Architecture spreadsheet (service catalog, integration matrix)
- **Option D:** C4 diagrams or other structured diagrams

If you don't have existing docs, create a simple diagram to migrate.

### 2. Document the "Before" State

**File:** `docs/migration-before-after.md`

**Start with:**
```markdown
# Architecture Documentation Migration

## Before: [Original Format]

### Source Document

- **Type:** [Diagram/Wiki/Spreadsheet]
- **Tool:** [Draw.io/Confluence/Excel]
- **Location:** [URL or file path]
- **Last Updated:** [Date, if known]
- **Maintainer:** [Who maintains it]

### Content Summary

[Describe what the original document contains]

- Components documented: [Number]
- Relationships shown: [Number]
- Metadata captured: [What's included]

### Screenshot/Export

![Original Documentation](screenshots/original-architecture-doc.png)

### Problems with Original Format

- ❌ **Not machine-readable:** Can't validate or query
- ❌ **No version control:** Changes not tracked
- ❌ **No governance:** Can't enforce standards
- ❌ **Siloed:** Not integrated with other documentation
- ❌ **Manual updates:** Error-prone and time-consuming
- ❌ **No automation:** Can't generate artifacts from it
```

### 3. Extract Components from Original Documentation

Create an inventory:

**File:** `docs/migration-inventory.md`

**Content:**
```markdown
# Migration Inventory

## Components from Original Documentation

| Component Name | Type | Description | Connected To |
|----------------|------|-------------|--------------|
| [Name] | [Service/DB/etc] | [What it does] | [List] |
| ... | ... | ... | ... |

## Integrations

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| ... | ... | ... | ... |

## Metadata Found

| Component | Metadata Available |
|-----------|-------------------|
| [Name] | Owner: X, Tech: Y, URL: Z |
| ... | ... |

## Missing Information

- [ ] Interface details (host, port)
- [ ] Security controls
- [ ] Business flows
- [ ] Deployment information
- [ ] [Other missing elements]

## Enhancement Opportunities

When migrating to CALM, we can add:
1. [What additional information should be captured]
2. [What governance can be added]
3. [What automation becomes possible]
```

### 4. Create the CALM Architecture

**Prompt:**
```text
Create a new CALM architecture file: architectures/migrated-[system-name].json

Based on the component inventory in docs/migration-inventory.md, create a complete CALM architecture including:

1. All components from the original documentation as nodes
2. All integrations as relationships
3. Enhanced with:
   - Proper metadata (owner, team, etc.)
   - Interface definitions
   - Security controls where applicable
   - Business flows if identifiable

Map the original documentation's concepts to CALM:
- Components → nodes
- Connections → relationships
- Groups/layers → composed-of relationships
- External systems → actor nodes

Make this production-quality, filling in gaps from the original documentation.
```

### 5. Enhance Beyond Original Documentation

Add elements the original documentation lacked:

**Prompt:**
```text
Enhance architectures/migrated-[system-name].json beyond the original documentation:

1. Add controls for security/compliance
2. Add at least one business flow
3. Add complete metadata to all nodes
4. Add interfaces with realistic host/port details
5. Add deployment topology (where things run)

The original doc had [X] components. The CALM version should be more comprehensive.
```

### 6. Create a Migration Guide

**File:** `docs/migration-guide.md`

**Content:**
```markdown
# CALM Migration Guide

## Purpose

This guide documents how to migrate architecture documentation to CALM format.

## Our Migration: [System Name]

### Original Documentation

- **Format:** [Type]
- **Components:** [Count]
- **Last updated:** [Date]
- **Problems:** Manual, not validated, hard to maintain

### Migration Process

#### Step 1: Inventory Components

Create `docs/migration-inventory.md` listing:
- All components
- All connections
- Any metadata

#### Step 2: Map to CALM Concepts

| Original Concept | CALM Equivalent |
|------------------|-----------------|
| Service box | node (type: service) |
| Database box | node (type: database) |
| Arrow/line | relationship (connects) |
| User icon | node (type: actor) |
| Group/layer | composed-of relationship |

#### Step 3: Create CALM File

Using inventory, create `architectures/migrated-[system-name].json`

#### Step 4: Enhance

Add what original doc lacked:
- Interface definitions
- Security controls
- Business flows
- Deployment topology
- Rich metadata

#### Step 5: Validate

\`\`\`bash
calm validate -a architectures/migrated-[system-name].json
\`\`\`

#### Step 6: Generate New Documentation

\`\`\`bash
calm docify --architecture architectures/migrated-[system-name].json --output docs/generated/migrated-system
\`\`\`

### Results

| Metric | Original | CALM | Improvement |
|--------|----------|------|-------------|
| Components | [X] | [Y] | +[Z] more complete |
| Connections | [X] | [Y] | +[Z] more detailed |
| Metadata | Minimal | Rich | Comprehensive |
| Validation | None | Automated | Quality assured |
| Governance | None | Pattern-based | Enforced |
| Documentation | Manual | Auto-generated | Always current |

### Benefits Achieved

1. **Machine-readable:** Can validate, query, transform
2. **Version controlled:** In git with full history
3. **Governance:** Can enforce standards with patterns
4. **Automated docs:** Generate multiple formats automatically
5. **Integration:** Part of CI/CD pipeline
6. **Comprehensive:** Added missing elements

## General Migration Tips

### From Diagrams

- Each box → node
- Each arrow → relationship
- Groups → use composed-of
- Layers → use deployed-in
- Colors → metadata properties

### From Wikis

- Component sections → nodes
- Integration descriptions → relationships
- Text descriptions → description fields
- Links to code → metadata properties

### From Spreadsheets

- Each row → node
- Connection columns → relationships
- Other columns → metadata
- Multiple sheets → separate architectures or composed-of

### Common Challenges

**Challenge:** Original doc ambiguous about connection types  
**Solution:** Interview team or infer from context

**Challenge:** Missing technical details  
**Solution:** Research actual implementation, talk to developers

**Challenge:** Outdated information  
**Solution:** Validate with current team, update as you migrate

**Challenge:** Too much detail to migrate  
**Solution:** Start with high-level, iterate to add detail

## Maintenance After Migration

1. **Deprecate original:** Mark old docs as "Migrated to CALM"
2. **Update process:** All updates go to CALM file
3. **Regenerate docs:** Run docify after changes
4. **CI validation:** Block merges if CALM validation fails
5. **Team training:** Teach team to update CALM directly
```

### 7. Complete the Before/After Documentation

Update `docs/migration-before-after.md`:

```markdown
## After: CALM Format

### New Architecture

- **File:** `architectures/migrated-[system-name].json`
- **Format:** CALM (JSON)
- **Version control:** Git
- **Validation:** Automated via CI

### Content Comparison

| Element | Before | After |
|---------|--------|-------|
| Components | [X] | [Y] |
| Connections | [X] | [Y] |
| Metadata fields | [X] | [Y] |
| Security controls | 0 | [Z] |
| Business flows | 0 | [Z] |
| Validation | Manual | Automated |

### Screenshot/Visualization

![CALM Architecture](screenshots/calm-migrated-architecture.png)

### Benefits Achieved

✅ **Machine-readable:** Can validate, query, and transform  
✅ **Version controlled:** Full git history  
✅ **Governed:** Pattern validation enforces standards  
✅ **Automated docs:** Multiple formats generated automatically  
✅ **Enhanced:** Added controls, flows, metadata beyond original  
✅ **CI/CD integrated:** Part of deployment pipeline  

### Generated Artifacts

From the single CALM file, we can now generate:
- HTML documentation website
- Executive summary
- Integration guide
- Security assessment
- Deployment checklist
- And more...

### Migration Metrics

- **Time to migrate:** [X hours]
- **Information loss:** 0% (everything preserved)
- **Information gain:** [Y%] (new elements added)
- **Ongoing maintenance:** Reduced (automated validation)
```

### 8. Generate Side-by-Side Comparison

```bash
# Generate CALM documentation
calm docify --architecture architectures/migrated-[system-name].json --output docs/generated/migrated-docs

# Generate comprehensive bundle
calm docify --architecture architectures/migrated-[system-name].json --template-dir templates/comprehensive-bundle --output docs/generated/migrated-bundle
```

### 9. Create Comparison Screenshots

**Steps:**
1. Open original documentation (diagram/wiki)
2. **Take screenshot** → `docs/screenshots/original-architecture-doc.png`
3. Open `architectures/migrated-[system-name].json` preview
4. **Take screenshot** → `docs/screenshots/calm-migrated-architecture.png`
5. Open generated docs at `docs/generated/migrated-docs/index.html`
6. **Take screenshot** → `docs/screenshots/calm-generated-docs.png`

### 10. Document Lessons Learned

**File:** `docs/migration-lessons-learned.md`

**Content:**
```markdown
# Migration Lessons Learned

## What Went Well

- [Specific successes from your migration]

## Challenges

- [Challenges encountered]
- [How you overcame them]

## Recommendations for Future Migrations

1. [Advice based on your experience]
2. [What to prepare before starting]
3. [Common pitfalls to avoid]

## Time Investment

- Initial migration: [X hours]
- Enhancement beyond original: [Y hours]
- Documentation: [Z hours]
- **Total:** [Total hours]

## ROI Estimation

**Costs:**
- Migration time: [X hours]

**Benefits:**
- Validation automation: [Y hours saved per year]
- Documentation generation: [Z hours saved per year]
- Onboarding time reduction: [Estimate]
- Error prevention: [Estimate]

**Payback period:** [Estimate]

## Would We Do It Again?

[Your assessment of whether migration to CALM was worth it]
```

### 11. Update Team Documentation

If this is for a real team, create a transition plan:

**File:** `docs/transition-plan.md`

**Content:**
```markdown
# Transition Plan: From [Original] to CALM

## Timeline

- **Week 1:** Migration complete (Day 22)
- **Week 2:** Team training on CALM
- **Week 3:** Parallel maintenance (update both)
- **Week 4:** CALM-only, original marked deprecated

## Team Training

- [ ] Share CALM basics presentation
- [ ] Walkthrough of our architecture file
- [ ] Demo of validation and generation
- [ ] Practice session: make updates together

## Process Changes

### Old Process
1. Update diagram in [Tool]
2. Export to PDF
3. Upload to wiki
4. Notify team

### New Process
1. Update `architectures/[system-name].json`
2. Run `calm validate`
3. Commit and push
4. CI auto-validates and generates docs
5. Docs automatically published

## Support

- Questions: [Channel/email]
- CALM resources: [Link to docs]
- Example PRs: [Links to sample changes]
```

### 12. Validate Migration

```bash
# Validate migrated architecture
calm validate -a architectures/migrated-[system-name].json

# Compare node counts
echo "Original components: [X from inventory]"
grep -c '"unique-id"' architectures/migrated-[system-name].json
```

### 13. Update Your README

Mark Day 22 complete in your README, summarize the before/after wins, and link to the migrated architecture plus the supporting docs (inventory, guide, lessons learned, transition plan, and screenshots).

### 14. Commit Migration Work

```bash
git add architectures/migrated-*.json docs/migration-*.md docs/transition-plan.md docs/screenshots README.md
git commit -m "Day 22: Migrate existing architecture documentation to CALM"
git tag day-22
```

## Deliverables

✅ **Required:**
- `architectures/migrated-[system-name].json` - Migrated architecture
- `docs/migration-before-after.md` - Before/after comparison
- `docs/migration-inventory.md` - Component inventory from original
- `docs/migration-guide.md` - How to migrate documentation
- `docs/migration-lessons-learned.md` - Lessons from migration
- `docs/transition-plan.md` - Team transition plan (if applicable)
- `docs/screenshots/` - Original, CALM, and generated docs
- Updated `README.md` - Day 22 marked complete

✅ **Validation:**
```bash
# Validate migrated architecture
calm validate -a architectures/migrated-*.json

# Verify documentation
test -f docs/migration-before-after.md
test -f docs/migration-guide.md
test -f docs/migration-lessons-learned.md

# Check screenshots exist
ls docs/screenshots/original-architecture-doc.png 2>/dev/null || echo "Add original doc screenshot"
test -f docs/screenshots/calm-migrated-architecture.png

# Verify generated docs
test -f docs/generated/migrated-docs/index.html

# Check tag
git tag | grep -q "day-22"
```

## Resources
- [C4 Model](https://c4model.com/) - Common architecture diagram format
- [PlantUML](https://plantuml.com/) - Diagram as code
- [Architecture Decision Records](https://adr.github.io/) - Decision documentation

## Tips
- Start with high-level, add detail iteratively
- Interview team members to fill gaps in original documentation
- Don't try to be perfect - iterate
- Document what you learned for next migration
- Original doc likely has outdated info - this is chance to fix it
- Migration is discovery - you'll find missing pieces
- Use AI to help extract info from documents by pointing the assistant at the exact files you inventoried

## Next Steps
Tomorrow (Day 23) you'll contribute to the CALM community!
