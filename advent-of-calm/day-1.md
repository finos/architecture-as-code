# Day 1: Install CALM CLI and Initialize Your Architecture Repository

## Overview
Set up your CALM workspace with AI-powered assistance and establish the foundation for your 24-day journey.

## Prerequisites

Ensure you have all the [prerequisites installed](../).

## Objective and Rationale
- **Objective:** Install the CALM CLI, create a git repository, and enable GitHub Copilot assistance for architecture development
- **Rationale:** Starting with a git-based workflow establishes good practices from day one. AI assistance accelerates learning and helps avoid common pitfalls. All your progress will be tracked in commits, creating a portfolio of your learning journey.

## Requirements

### 1. Create Your Repository
```bash
mkdir advent-of-calm-2025
cd advent-of-calm-2025
git init
```

### 2. Install the CALM CLI
```bash
npm install -g @finos/calm-cli
```

Verify installation:
```bash
calm --version
```

### 3. Initialize Your Project Structure
Create a basic structure for your architecture files:

```bash
mkdir architectures
mkdir patterns
mkdir docs
touch README.md
```

### 4. Create Your Initial README
Add the following to `README.md`:

```markdown
# My Advent of CALM Journey

This repository tracks my 24-day journey learning the Common Architecture Language Model (CALM).

## Progress

- [x] Day 1: Install CALM CLI and Initialize Repository
- [ ] Day 2: TBD
- [ ] Day 3: TBD
...

## Architectures

This directory will contain CALM architecture files documenting systems.

## Patterns

This directory will contain CALM patterns for architectural governance.

## Docs

Generated documentation from CALM models.
```

### 5. Enable AI Assistance with Copilot Chatmode
```bash
calm copilot-chatmode -d .
```

This creates `.github/chatmodes/CALM.chatmode.md` with specialized CALM knowledge for GitHub Copilot.

### 6. Add a .gitignore
Create `.gitignore`:

```
node_modules/
.DS_Store
*.log
.vscode/settings.json
**/.docusaurus/
```

### 7. Make Your First Commit
```bash
git add .
git commit -m "Day 1: Initialize Advent of CALM repository with CLI and AI assistance"
git tag day-1
```

### 8. Create a GitHub Repository (Recommended)
Push to GitHub to enable:
- GitHub Copilot integration (if you have access)
- Public portfolio of your progress
- Community visibility

```bash
# Create repo on GitHub, then:
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main --tags
```

## Deliverables / Validation Criteria

Your Day 1 submission should include a commit tagged `day-1` containing:

✅ **Required Files:**
- `README.md` - Project introduction with progress checklist
- `.github/chatmodes/CALM.chatmode.md` - Copilot configuration
- `.gitignore` - Basic ignore patterns
- `architectures/` - Empty directory (ready for Day 2)
- `patterns/` - Empty directory
- `docs/` - Empty directory

✅ **Validation:**
```bash
# Test CALM CLI is installed
calm --version

# Verify chatmode file exists and contains CALM schema guidance
test -f .github/chatmodes/CALM.chatmode.md && grep -q "CALM" .github/chatmodes/CALM.chatmode.md

# Check git tag exists
git tag | grep -q "day-1"
```

## Resources
- [CALM CLI Documentation](https://github.com/finos/architecture-as-code/tree/main/cli)
- [CALM Quickstart](https://calm.finos.org/quick-start/)
- [GitHub Copilot Chat](https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide)

## Tips
- If you don't have GitHub Copilot access, the chatmode file is still useful as documentation for you to reference
- Use descriptive commit messages - they tell the story of your learning
- Consider making your repository public to inspire others
- Tag each day's work (`day-1`, `day-2`, etc.) to create clear milestones

## Next Steps
Tomorrow (Day 2) you'll create your first CALM architecture file using AI assistance!
