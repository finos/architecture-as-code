# Advent of CALM - AI Assistant Guide

This guide helps AI assistants work efficiently with the Advent of CALM educational content.

## Project Overview

**Advent of CALM** is a 24-day progressive learning challenge for the Common Architecture Language Model (CALM), inspired by "Advent of Code". It takes learners from zero CALM knowledge to being able to model production architectures and contribute to the community.

**Target Audience**: Developers, architects, and technical leads learning CALM
**Format**: Daily hands-on challenges with cumulative learning
**Timeframe**: December 1-24 (24 days)

## Project Structure

```
advent-of-calm/
├── home.md              # Landing page content
├── setup.md             # Tool installation and update instructions
├── day-1.md             # Day 1: Install CLI and setup
├── day-2.md             # Day 2: Create first architecture
├── ...
├── day-24.md            # Day 24: (to be created)
└── website/             # Astro static site
    ├── src/
    │   ├── content/days/     # Copied from parent (day-*.md, setup.md)
    │   ├── pages/            # Astro pages
    │   ├── components/       # UI components
    │   ├── layouts/          # Page layouts
    │   └── styles/           # CSS
    ├── public/               # Static assets
    ├── astro.config.mjs      # Astro configuration
    └── package.json          # Website dependencies
```

## Content Structure

### 4-Week Curriculum

**Week 1 (Days 1-7): Foundation & First Steps**
- Day 1: CLI setup, git initialization
- Days 2-7: Basic CALM concepts (nodes, relationships, interfaces, metadata)
- Outcome: First complete architecture

**Week 2 (Days 8-14): Controls, Flows & AI-Assisted Operations**
- Days 8-10: Controls (security), ADRs, Flows (business processes)
- Days 11-14: AI integration (chatmode, analysis, documentation generation)
- Outcome: Governed architecture with AI-assisted workflows

**Week 3 (Days 15-18): Patterns & Automation**
- Days 15-18: Operational metadata, patterns, validation, CI/CD
- Outcome: Reusable patterns and automated validation

**Week 4 (Days 19-24): Real-World Application & Community**
- Days 19+: Real-world scenarios, portfolio building, community contribution
- Outcome: Production-ready skills and public portfolio

### Day Content Format

Each `day-N.md` follows this structure:

```markdown
# Day N: [Clear Task Title]

## Overview
Brief 1-2 sentence description

## Objective and Rationale
- **Objective:** What you'll accomplish
- **Rationale:** Why this matters in real-world architecture

## Requirements

### 1. [Requirement Name]
Detailed instructions with code examples

### 2. [Next Requirement]
Step-by-step guidance

## Testing Your Solution
How to validate the work

## Success Criteria
Clear checklist of what "done" looks like

## Troubleshooting
Common issues and solutions

## Going Further (Optional)
Advanced extensions for learners who want more

## Reflection
Questions to consolidate learning
```

## Key Concepts

### Progressive Learning
- Each day builds on previous days
- Cumulative architecture grows in complexity
- Early days focus on single concepts; later days combine multiple concepts
- "Going Further" sections provide optional depth

### AI-First Approach
- GitHub Copilot integration starts Day 1
- CALM chatmode introduced Day 11
- AI used for generation, validation, and documentation
- Teaches both CALM and AI-assisted workflows

### Git-Based Portfolio
- All work committed to git
- Daily tags (e.g., `git tag day-1-complete`)
- Portfolio showcases learning journey
- Encourages good practices from the start

### Real-World Context
The curriculum uses a **running e-commerce example**:
- Week 1: Build basic order processing system
- Week 2: Add payment, inventory, security controls
- Week 3: Create reusable patterns, add CI/CD
- Week 4: Handle incidents, scale, contribute back

## Website (Astro Static Site)

### Tech Stack
- **Framework**: Astro 5+ (static site generator)
- **Language**: TypeScript
- **Content**: Markdown files copied from parent directory
- **Styling**: CSS (custom)

### Key Commands

```bash
cd website

# Development
npm run dev              # Start dev server (copies content first)
npm start                # Alternative: start dev server

# Build
npm run build            # Copy content + Astro build
npm run preview          # Preview production build

# Content sync
npm run copy:content     # Manually copy markdown files
```

### Content Pipeline

1. **Source**: Markdown files in `advent-of-calm/` (day-*.md, setup.md, home.md)
2. **Copy**: `npm run copy:content` syncs to `website/src/content/days/`
3. **Build**: Astro processes and generates static HTML
4. **Deploy**: Static files in `website/dist/`

### Important Build Details

- **Content must be copied before build** - The website doesn't read from parent directory
- `npm run dev` and `npm run build` both run `copy:content` first
- Site config: `base: '/advent/'` - deployed under `/advent/` path
- Trailing slashes enforced for clean URLs

## Working with Advent of CALM

### Creating/Editing Day Content

**When creating or editing a day:**

1. Edit the `day-N.md` file in `advent-of-calm/` root (NOT in website/src/)
2. Follow the standard format (see "Day Content Format" above)
3. Include code examples in proper markdown code blocks
4. Add clear success criteria and testing instructions
5. Test locally by copying to website and previewing

**Content Guidelines:**
- Use conversational, encouraging tone
- Provide clear "why" explanations (rationale)
- Include both basic and "Going Further" content
- Add troubleshooting for common issues
- Link to CALM docs for deeper reading
- Use realistic examples (the e-commerce architecture)

### Testing Content Changes

```bash
# 1. Edit day-N.md in advent-of-calm/
vim day-10.md

# 2. Preview in website
cd website
npm run dev

# 3. Check http://localhost:4321/advent/days/day-10/

# 4. When satisfied, commit
cd ..
git add day-10.md
git commit -m "docs(advent): update day 10 ADR linking"
```

### Creating New Days

**Checklist for new day content:**

- [ ] Create `day-N.md` following standard format
- [ ] Include Overview, Objectives, Requirements
- [ ] Add code examples with proper syntax highlighting
- [ ] Write Testing and Success Criteria sections
- [ ] Add Troubleshooting section
- [ ] Include "Going Further" optional extensions
- [ ] Add Reflection questions
- [ ] Test in website (`npm run dev`)
- [ ] Ensure builds without errors (`npm run build`)
- [ ] Update `home.md` if week structure changes
- [ ] Commit with descriptive message

### Common Tasks

**Add a new day:**
```bash
# 1. Create from template or copy previous day
cp day-19.md day-20.md

# 2. Edit day-20.md with new content
# 3. Test in website
cd website && npm run dev

# 4. Commit
cd .. && git add day-20.md
git commit -m "docs(advent): add day 20 - [topic]"
```

**Update existing content:**
```bash
# 1. Edit the markdown file
vim day-5.md

# 2. Test changes
cd website && npm run dev

# 3. Commit
cd .. && git add day-5.md
git commit -m "docs(advent): clarify day 5 interface examples"
```

**Update setup/home pages:**
```bash
# Edit home.md or setup.md
vim setup.md

# Test and commit as above
```

## Testing Day Content

### Manual Testing Checklist

When testing a day's content:

- [ ] All code examples are syntactically correct
- [ ] Commands work when run in a fresh directory
- [ ] File paths are correct (relative to learner's workspace)
- [ ] GitHub Copilot prompts produce expected results
- [ ] Success criteria are achievable
- [ ] Troubleshooting covers real issues
- [ ] Links to docs/tools work
- [ ] Markdown renders correctly in website

### Common Issues to Check

1. **Code Block Syntax**: Ensure language tags are correct (```bash, ```json)
2. **File Paths**: Use relative paths from learner's workspace root
3. **CALM CLI Commands**: Test commands actually work with current CLI version
4. **JSON Examples**: Validate JSON syntax (no trailing commas, proper quotes)
5. **Copilot Prompts**: Test prompts produce reasonable CALM output
6. **Links**: Verify all URLs resolve correctly

## Writing Style Guide

### Tone
- Encouraging and supportive (it's a learning challenge)
- Clear and direct (avoid unnecessary complexity)
- Expert but approachable (teach best practices, explain why)

### Structure
- Start with clear objective (what + why)
- Break complex tasks into numbered steps
- Provide code examples with explanations
- End with validation and reflection

### Code Examples
- Use realistic, production-like examples
- Add comments for complex parts
- Show expected output
- Include error cases in troubleshooting

### Assumptions
- Learner has basic git/CLI knowledge
- Learner has Node.js, VSCode, and Copilot installed
- Learner follows days sequentially (builds on previous work)
- Learner creates architecture files in a git repository

## Content Philosophy

### Progressive Complexity
- Day 1-7: Single concepts, clear success
- Day 8-14: Multiple concepts, integration
- Day 15-21: Real-world scenarios, decision-making
- Day 22-24: Community, contribution, mastery

### Hands-On First
- Every day has tangible output
- Learn by doing, not just reading
- Immediate feedback (CLI validation, visual tools)

### AI-Augmented Learning
- Use AI as learning accelerator
- Teach prompt engineering for architecture
- Show AI's strengths (generation) and limits (validation)

### Portfolio Building
- Git commits create learning timeline
- Architecture files become portfolio examples
- Shareable GitHub repository demonstrates skills

## Dependencies

The content assumes learners have:
- CALM CLI (`@finos/calm-cli`) installed globally
- CALM VSCode extension installed
- GitHub Copilot access (required for AI-assisted days)
- Git and basic command-line knowledge

**Important**: Keep content in sync with CLI versions. When CLI changes, update affected days.

## Deployment

The website is built and deployed separately from the markdown content:
- Markdown files are source of truth
- Website is generated from markdown
- Deploy process handled by CI/CD (typically GitHub Actions)
- Deployed URL: `https://calm.finos.org/advent/`

## Useful Links

- [CALM Documentation](https://calm.finos.org) - Main CALM docs
- [CALM CLI](../cli/) - CLI source code and docs
- [CALM VSCode Extension](../calm-plugins/vscode/) - Extension source
- [Astro Docs](https://docs.astro.build) - Astro framework reference

## Notes for AI Assistants

When working on Advent of CALM content:

1. **Always edit source markdown files** (`advent-of-calm/day-N.md`), not website copies
2. **Test in website** after changes to verify rendering
3. **Follow the standard format** for consistency across days
4. **Validate CALM examples** - ensure JSON is syntactically correct and follows CALM schema
5. **Check sequence dependencies** - each day builds on previous days
6. **Update incrementally** - keep e-commerce example consistent across days
7. **Consider learner perspective** - they're learning CALM, not experts yet
8. **Test Copilot prompts** - prompts should work with actual GitHub Copilot
9. **Keep content current** - sync with latest CALM CLI and schema versions
10. **Commit descriptively** - use conventional commits (docs(advent): ...)
