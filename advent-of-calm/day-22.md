# Day 22: Contributing to the CALM Copilot Chatmode

## Overview
Learn how to contribute to the CALM AI tools by raising Pull Requests against the calm-ai project.

## Objective and Rationale
- **Objective:** Understand the CALM AI tools structure and make a contribution to improve the Copilot chatmode
- **Rationale:** The CALM Copilot chatmode is powered by AI prompts and guides in the calm-ai project. By contributing improvements, you help every CALM user get better AI assistance. This is a great way to give back to the community!

## Requirements

### 1. Understand the CALM AI Project

The `calm-ai` directory contains AI tools and prompts that power the CALM chatmode:

```bash
ls calm-ai/
```

**Structure:**
- `CALM.chatmode.md` - The main chatmode configuration
- `README.md` - Project documentation
- `tools/` - Individual tool prompt files

### 2. Explore the Tool Prompts

Each tool file provides guidance for specific CALM tasks:

```bash
ls calm-ai/tools/
```

**Available tools:**
- `architecture-creation.md` - Creating CALM architectures
- `node-creation.md` - Creating nodes with proper validation
- `relationship-creation.md` - Creating relationships between nodes
- `interface-creation.md` - Critical guidance for interface constraints
- `pattern-creation.md` - Creating reusable patterns
- `standards-creation.md` - Creating JSON Schema Standards
- `flow-creation.md` - Modelling business process flows
- `control-creation.md` - Adding compliance controls
- `metadata-creation.md` - Adding metadata arrays
- `documentation-creation.md` - Generating documentation
- `calm-cli-instructions.md` - CLI commands and usage

### 3. Review a Tool File

**Prompt:**
```text
Read calm-ai/tools/standards-creation.md and summarize:
1. What guidance does it provide?
2. How is it structured?
3. What examples does it include?
4. What could be improved based on your experience?
```

### 4. Identify an Improvement

Based on your Advent of CALM journey, identify something that could be improved:

**Ideas for contributions:**
- Add examples you wish existed when learning
- Clarify confusing instructions you encountered
- Add common pitfalls you discovered
- Improve validation guidance
- Add cross-references between related tools
- Fix typos or outdated information

**Prompt:**
```text
Based on my Advent of CALM experience, suggest 3 improvements I could make to the calm-ai tools:

1. Something I found confusing that could be clearer
2. An example that would have helped me
3. A pitfall I encountered that others should know about
```

### 5. Fork the Repository (If Contributing Externally)

If you're contributing to the main FINOS repository:

```bash
# Fork via GitHub UI, then:
git remote add upstream https://github.com/finos/architecture-as-code.git
git fetch upstream
```

For this exercise, you can work in your local copy.

### 6. Create a Feature Branch

```bash
git checkout -b feat/improve-calm-ai-tools
```

### 7. Make Your Improvement

Choose one improvement and implement it:

**Example: Adding a tip to standards-creation.md**

**Prompt:**
```text
Update calm-ai/tools/standards-creation.md to add a "Common Mistakes" section after "Best Practices" that includes:

1. Forgetting to set additionalProperties
2. Using wrong JSON Schema version
3. Not testing Standards with calm validate
4. Property name conflicts with core CALM schema
```

### 8. Document Your Contribution

**File:** `docs/my-contribution.md`

**Prompt:**
```text
Create docs/my-contribution.md that documents:

1. What I Changed:
   - File modified
   - Nature of the change
   - Why it helps

2. How I Tested:
   - Reviewed the markdown renders correctly
   - Verified examples are valid

3. PR Description Draft:
   - Title: "feat(calm-ai): Add common mistakes section to standards-creation"
   - Body: Description of what and why
```

### 9. Prepare a Pull Request Description

Write a PR description following FINOS guidelines:

```markdown
## Description
Added a "Common Mistakes" section to the standards-creation.md tool prompt to help users avoid common pitfalls when creating CALM Standards.

## Motivation
During the Advent of CALM challenge, I encountered several issues that could have been avoided with clearer guidance. This addition helps future users.

## Changes
- Added "Common Mistakes" section with 4 common issues and solutions
- Added cross-reference to validation documentation

## Testing
- Markdown renders correctly
- Examples validate with CALM CLI

## Checklist
- [ ] I have read the CONTRIBUTING guidelines
- [ ] My changes follow the project's style
- [ ] I have tested my changes
```

### 10. Commit Your Changes

```bash
git add calm-ai/tools/standards-creation.md docs/my-contribution.md README.md
git commit -m "feat(calm-ai): Add common mistakes section to standards-creation guide"
git tag day-22
```

### 11. (Optional) Submit Your PR

If you want to actually contribute:
1. Push to your fork: `git push origin feat/improve-calm-ai-tools`
2. Open a PR on GitHub
3. Fill in the PR template
4. Wait for review and feedback

## Deliverables / Validation Criteria

Your Day 22 submission should include a commit tagged `day-22` containing:

✅ **Required Files:**
- Modified file in `calm-ai/tools/` (your improvement)
- `docs/my-contribution.md` - Documentation of your contribution
- Updated `README.md` - Day 22 marked as complete

✅ **Validation:**
```bash
# Contribution documented
test -f docs/my-contribution.md

# Check tag
git tag | grep -q "day-22"
```

## Resources

- [CALM AI Project](https://github.com/finos/architecture-as-code/tree/main/calm-ai)
- [FINOS Contributing Guidelines](https://github.com/finos/architecture-as-code/blob/main/CONTRIBUTING.md)
- [GitHub PR Best Practices](https://docs.github.com/en/pull-requests)

## Tips

- Small, focused contributions are easier to review
- Good PR descriptions help reviewers understand your intent
- Test your changes locally before submitting
- Be patient - maintainers are volunteers too
- Respond to feedback constructively

## Types of Contributions Welcome

- **Documentation**: Improve clarity, add examples
- **Examples**: Add working examples for edge cases
- **Bug Fixes**: Fix incorrect information
- **New Features**: Propose new tool prompts
- **Translations**: Help make CALM accessible globally

## The Contribution Workflow

1. **Find** an issue or improvement opportunity
2. **Fork** the repository (if external)
3. **Branch** for your feature
4. **Implement** your changes
5. **Test** your changes work
6. **Document** what you changed and why
7. **Submit** a PR with clear description
8. **Respond** to review feedback
9. **Celebrate** when merged! 🎉

## Next Steps

Tomorrow (Day 23) you'll explore a community contribution - the calm-explorer project!
