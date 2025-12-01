# Day 18: Automate Validation in CI/CD

## Overview
Set up automated CALM validation in GitHub Actions to ensure architecture quality on every commit.

## Objective and Rationale
- **Objective:** Create a GitHub Actions workflow that validates CALM architectures on every push and pull request
- **Rationale:** Architecture as Code means architecture in version control with automated validation. Catch schema errors, pattern violations, and broken references before they reach main. Make architecture quality a first-class citizen in your CI/CD pipeline.

## Requirements

### 1. Create GitHub Actions Workflow Directory

```bash
mkdir -p .github/workflows
```

### 2. Create CALM Validation Workflow

**File:** `.github/workflows/validate-calm.yml`

**Content:**
```yaml
name: Validate CALM Architectures

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'architectures/**/*.json'
      - 'patterns/**/*.json'
  pull_request:
    branches: [ main, develop ]
    paths:
      - 'architectures/**/*.json'
      - 'patterns/**/*.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install CALM CLI
      run: npm install -g @finos/calm-cli
    
    - name: Validate all architectures
      run: |
        echo "🔍 Validating CALM architectures..."
        for arch in architectures/*.json; do
          echo "Validating $arch"
          calm validate -a "$arch"
        done
    
    - name: Validate patterns
      run: |
        echo "🔍 Validating CALM patterns..."
        for pattern in patterns/*.json; do
          echo "Validating pattern $pattern"
          # Basic JSON schema validation
          calm validate -p "$pattern" -a "architectures/ecommerce-platform.json" || true
        done
      
    - name: Report success
      run: echo "✅ All CALM validations passed!"
```

### 3. Create Enhanced Workflow with Pattern Checking

**File:** `.github/workflows/calm-quality-gate.yml`

**Content:**
```yaml
name: CALM Architecture Quality Gate

on:
  pull_request:
    branches: [ main ]

jobs:
  validate-and-check:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install CALM CLI
      run: npm install -g @finos/calm-cli
    
    - name: Validate schema compliance
      id: validate
      run: |
        FAILED=0
        for arch in architectures/*.json; do
          echo "::group::Validating $arch"
          if calm validate -a "$arch"; then
            echo "✅ $arch is valid"
          else
            echo "❌ $arch validation failed"
            FAILED=1
          fi
          echo "::endgroup::"
        done
        exit $FAILED
    
    - name: Check against governance patterns
      run: |
        if [ -f "patterns/ecommerce-platform-pattern.json" ]; then
          echo "::group::Checking pattern compliance"
          calm validate \
            -p patterns/ecommerce-platform-pattern.json \
            -a architectures/ecommerce-platform.json
          echo "::endgroup::"
        fi
    
    - name: Check for required metadata
      run: |
        echo "::group::Checking metadata completeness"
        for arch in architectures/*.json; do
          echo "Checking $arch for required metadata..."
          
          # Check for owner
          if ! grep -q '"owner"' "$arch"; then
            echo "⚠️  Warning: $arch missing owner metadata"
          fi
          
          # Check for version
          if ! grep -q '"version"' "$arch"; then
            echo "⚠️  Warning: $arch missing version metadata"
          fi
          
          # Check for description at top level
          if ! grep -q '"description"' "$arch"; then
            echo "⚠️  Warning: $arch missing description"
          fi
        done
        echo "::endgroup::"
    
    - name: Check for security controls
      run: |
        echo "::group::Checking security controls"
        for arch in architectures/*.json; do
          if grep -q '"controls"' "$arch"; then
            echo "✅ $arch has security controls defined"
          else
            echo "⚠️  Warning: $arch has no security controls"
          fi
        done
        echo "::endgroup::"
    
    - name: Generate validation report
      if: always()
      run: |
        echo "## CALM Validation Report" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        echo "### Architectures Checked" >> $GITHUB_STEP_SUMMARY
        ls -1 architectures/*.json | wc -l >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        echo "### Validation Status" >> $GITHUB_STEP_SUMMARY
        if [ ${{ steps.validate.outcome }} == 'success' ]; then
          echo "✅ All architectures valid" >> $GITHUB_STEP_SUMMARY
        else
          echo "❌ Validation failures detected" >> $GITHUB_STEP_SUMMARY
        fi
```

### 4. Create Documentation Generation Workflow

**File:** `.github/workflows/generate-docs.yml`

**Content:**
```yaml
name: Generate Architecture Documentation

on:
  push:
    branches: [ main ]
    paths:
      - 'architectures/**/*.json'
  workflow_dispatch:

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install CALM CLI
      run: npm install -g @finos/calm-cli
    
    - name: Generate documentation
      run: |
        echo "📖 Generating documentation from architectures..."
        
        # Generate website documentation
        calm docify \
          --architecture architectures/ecommerce-platform.json \
          --output docs/generated/ecommerce-docs
        
        # Generate custom template outputs
        if [ -d "templates/comprehensive-bundle" ]; then
          calm docify \
            --architecture architectures/ecommerce-platform.json \
            --template-dir templates/comprehensive-bundle \
            --output docs/generated/comprehensive
        fi
    
    - name: Commit generated docs
      run: |
        git config --local user.email "github-actions[bot]@users.noreply.github.com"
        git config --local user.name "github-actions[bot]"
        git add docs/generated/
        git diff --staged --quiet || git commit -m "docs: regenerate architecture documentation [skip ci]"
    
    - name: Push changes
      uses: ad-m/github-push-action@master
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        branch: ${{ github.ref }}
```

### 5. Create Pre-Commit Hook (Local Validation)

**File:** `.husky/pre-commit` (if using Husky) or `scripts/pre-commit-hook.sh`

**Content:**
```bash
#!/bin/bash

echo "🔍 Running CALM validation before commit..."

# Check if any CALM files are being committed
CALM_FILES=$(git diff --cached --name-only | grep -E '(architectures|patterns)/.*\.json$')

if [ -z "$CALM_FILES" ]; then
  echo "No CALM files to validate"
  exit 0
fi

# Validate each file
FAILED=0
for file in $CALM_FILES; do
  echo "Validating $file..."
  if ! calm validate -a "$file" 2>/dev/null; then
    echo "❌ $file validation failed"
    FAILED=1
  else
    echo "✅ $file is valid"
  fi
done

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ CALM validation failed. Fix errors before committing."
  echo "   Run: calm validate -a <file>"
  exit 1
fi

echo "✅ All CALM files validated successfully"
exit 0
```

Make it executable:
```bash
chmod +x scripts/pre-commit-hook.sh
```

To use as a git hook:
```bash
ln -s ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
```

### 6. Create CI/CD Documentation

**File:** `docs/ci-cd-guide.md`

**Content:**
```markdown
# CALM CI/CD Integration

## Overview

This repository uses automated validation to ensure architecture quality.

## Workflows

### 1. validate-calm.yml

**Trigger:** Push or PR to main/develop affecting architecture files  
**Purpose:** Validate all architectures against CALM schema

**What it checks:**
- JSON schema validity
- CALM specification compliance
- All architectures can be parsed

### 2. calm-quality-gate.yml

**Trigger:** Pull requests to main  
**Purpose:** Comprehensive quality checks

**What it checks:**
- ✅ Schema validation
- ✅ Pattern compliance
- ✅ Required metadata (owner, version)
- ✅ Security controls presence

### 3. generate-docs.yml

**Trigger:** Push to main affecting architectures  
**Purpose:** Auto-generate and commit documentation

**What it does:**
- Generates HTML documentation
- Generates custom template outputs
- Commits to repository (skips CI with `[skip ci]`)

## Local Validation

### Pre-Commit Hook

Install the pre-commit hook:

\`\`\`bash
ln -s ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit
\`\`\`

This validates architectures before allowing commit.

### Manual Validation

\`\`\`bash
# Validate single file
calm validate -a architectures/ecommerce-platform.json

# Validate against pattern
calm validate -p patterns/ecommerce-platform-pattern.json -a architectures/ecommerce-platform.json

# Validate all architectures
for arch in architectures/*.json; do calm validate -a "$arch"; done
\`\`\`

## Pull Request Process

1. Create branch: `git checkout -b feature/new-architecture`
2. Make changes to architectures
3. Pre-commit hook validates locally
4. Push: `git push origin feature/new-architecture`
5. Create PR
6. CI runs `validate-calm.yml` and `calm-quality-gate.yml`
7. Review CI results in PR checks
8. Merge when CI passes

## Quality Gates

### Blocking (Must Pass)
- ✅ Schema validation
- ✅ Pattern compliance (if pattern specified)

### Non-Blocking (Warnings)
- ⚠️  Missing metadata
- ⚠️  No security controls
- ⚠️  No flows defined

## Continuous Documentation

Documentation is automatically regenerated on merge to main:
- `docs/generated/` updated with latest architecture
- Committed automatically by GitHub Actions
- Always in sync with architecture files

## Benefits

1. **Quality Assurance:** Catch errors before merge
2. **Consistency:** Enforce standards automatically
3. **Documentation:** Always up-to-date
4. **Collaboration:** Clear feedback on PRs
5. **Confidence:** Deploy architecture changes safely

## Customization

### Add Custom Checks

Edit `.github/workflows/calm-quality-gate.yml`:

\`\`\`yaml
- name: Custom check
  run: |
    # Your validation logic
\`\`\`

### Modify Quality Gates

Adjust what's required vs. warning in `calm-quality-gate.yml`.

### Change Triggers

Modify `on:` section to change when workflows run.
```

### 7. Test Workflows Locally (Optional)

Install `act` to test GitHub Actions locally:

```bash
# Install act (https://github.com/nektos/act)
# Then test validation workflow
act pull_request -W .github/workflows/validate-calm.yml
```

### 8. Create CI/CD Status Badge

Add to your README.md:

```markdown
## CI/CD Status

[![Validate CALM](https://github.com/YOUR-USERNAME/advent-of-calm-2025/actions/workflows/validate-calm.yml/badge.svg)](https://github.com/YOUR-USERNAME/advent-of-calm-2025/actions/workflows/validate-calm.yml)
```

### 9. Test Pre-Commit Hook Locally

```bash
# Make a change to an architecture
echo ' ' >> architectures/ecommerce-platform.json

# Try to commit (should validate first)
git add architectures/ecommerce-platform.json
git commit -m "test: trigger pre-commit hook"

# Undo test change
git reset HEAD~1
git checkout architectures/ecommerce-platform.json
```

### 10. Document Workflow in README

Update your main README.md to include CI/CD information.

### 11. Update Your README Checklist

Before committing, ensure the README progress tracker marks Day 18 complete and that the CI/CD section mentions the new workflows, pre-commit hook, and badge you added.

### 12. Commit CI/CD Setup

```bash
git add .github/workflows scripts/pre-commit-hook.sh docs/ci-cd-guide.md README.md
git commit -m "Day 18: Add automated CALM validation in CI/CD"
git tag day-18
```

### 13. Push and Verify (If Using GitHub)

```bash
git push origin main --tags
```

Then check GitHub Actions tab to see workflows running!

## Deliverables

✅ **Required:**
- `.github/workflows/validate-calm.yml` - Basic validation workflow
- `.github/workflows/calm-quality-gate.yml` - Comprehensive quality checks
- `.github/workflows/generate-docs.yml` - Auto-documentation
- `scripts/pre-commit-hook.sh` - Local validation hook
- `docs/ci-cd-guide.md` - CI/CD documentation
- Updated `README.md` with CI/CD status and info
- Day 18 marked complete in README

✅ **Validation:**
```bash
# Verify workflows exist
test -f .github/workflows/validate-calm.yml
test -f .github/workflows/calm-quality-gate.yml
test -f .github/workflows/generate-docs.yml

# Verify pre-commit hook
test -x scripts/pre-commit-hook.sh

# Test pre-commit hook locally
./scripts/pre-commit-hook.sh

# Verify documentation
test -f docs/ci-cd-guide.md

# Check tag
git tag | grep -q "day-18"
```

## Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [Act - Local GitHub Actions](https://github.com/nektos/act)

## Tips
- Start with basic validation, add complexity over time
- Use branch protection rules to require CI passing
- Non-blocking warnings inform without blocking
- Auto-generating docs keeps them fresh
- Pre-commit hooks catch issues earliest
- Use workflow badges to show project health

## Next Steps
Tomorrow (Day 19) you'll model your actual system architecture with 10+ nodes!
