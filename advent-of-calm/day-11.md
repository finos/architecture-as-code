# Day 11: Share Your Architecture with a Documentation Website

## Overview
Generate a shareable documentation website from your CALM architecture - making your architecture knowledge accessible to anyone with a browser.

## Objective and Rationale
- **Objective:** Use `calm docify` to generate a comprehensive documentation website that can be shared across your organisation
- **Rationale:** Architecture knowledge locked in JSON files or local tools limits its value. By generating a static website, you can publish your architecture documentation to internal hosting, share it with stakeholders who don't have development tools, and ensure everyone has access to the same source of truth.

## Requirements

### 1. Understand the Value of Shareable Documentation

Until now, viewing your architecture required either:
- The VSCode Extension (requires VSCode installed)
- Reading raw JSON (requires technical knowledge)

A documentation website solves this by:
- **Accessibility:** Anyone with a browser can view it
- **Shareability:** Host on internal servers, GitHub Pages, or any static hosting
- **Consistency:** Everyone sees the same documentation
- **Self-serve:** Stakeholders can explore without asking architects

### 2. Generate Your Documentation Website

```bash
calm docify --architecture architectures/ecommerce-platform.json --output docs/generated/ecommerce-docs
```

This creates a complete HTML website with:
- Index page with architecture overview
- Node details pages
- Relationship visualisations  
- Flow diagrams
- Control and metadata display

### 3. Run the Documentation Website

The generated website is a self-contained application. Install dependencies and start it:

```bash
cd docs/generated/ecommerce-docs
npm install
npm start
```

This will start a local development server. Open the URL shown in your terminal (usually `http://localhost:3000`) to browse your architecture documentation.

**Explore the website:**
- Navigate through different sections (nodes, relationships, flows, controls)
- Click on nodes to see their details
- View flow sequence diagrams
- **Take screenshots** of the main pages to share

When done, press `Ctrl+C` to stop the server and return to your project root:

```bash
cd ../../..
```

### 4. When to Use the Website vs VSCode Extension

| Use Case | Best Tool |
|----------|-----------|
| Developing/editing architecture | VSCode Extension |
| Sharing with non-technical stakeholders | Documentation Website |
| Architecture review meetings | Documentation Website |
| Quick local preview while coding | VSCode Extension |
| Publishing to team wiki/intranet | Documentation Website |
| Onboarding new team members | Documentation Website |

**Rule of thumb:** Use VSCode for development, use the website for sharing.

### 5. Consider Your Publishing Strategy

Think about how you would publish this website in your organisation:

- **GitHub Pages:** Free, automatic from a branch
- **Internal static hosting:** Copy the built files to any web server
- **CI/CD integration:** Regenerate docs automatically when architecture changes

> 💡 **Tip:** Add docify to your CI/CD pipeline so documentation is always up-to-date with your architecture.

### 6. Update Your README

Document Day 11 progress in your README: mark the checklist, describe the documentation website, and note where to find the generated site.

### 7. Commit Your Work

```bash
git add docs/generated/ README.md
git commit -m "Day 11: Generate shareable documentation website"
git tag day-11
```

## Deliverables

✅ **Required:**
- `docs/generated/ecommerce-docs/` - Full website documentation
- Screenshots of generated documentation website
- Updated `README.md` - Day 11 marked complete

✅ **Validation:**
```bash
# Verify generated documentation exists
test -d docs/generated/ecommerce-docs

# Check tag
git tag | grep -q "day-11"
```

## Resources

- [Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)

## Tips

- Regenerate documentation after every architecture change
- Add documentation generation to CI/CD pipeline for always up-to-date docs
- Deploy the generated website to your internal hosting for team access
- The website works great for architecture reviews and stakeholder presentations

## Next Steps
Tomorrow (Day 12) you'll learn how to create custom documentation using calm-widgets - the building blocks that power this website!
