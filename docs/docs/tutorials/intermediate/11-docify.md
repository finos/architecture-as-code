---
id: 11-docify
title: "Share Your Architecture as a Website"
sidebar_position: 5
---

# Share Your Architecture as a Website

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

## Overview

Generate a shareable documentation website from your CALM architecture — making your architecture knowledge accessible to anyone with a browser.

## Learning Objectives

By the end of this tutorial, you will:
- Use `calm docify` to generate a complete static documentation website
- Understand when to use the generated website versus the VSCode extension
- Know how to serve and navigate the generated website locally
- Consider strategies for publishing the website to your organization

## Prerequisites

Complete [Link Architecture Decision Records](./10-adr-linking) first. Ensure your CALM CLI is version 1.22.1 or above:

```bash
calm --version
```

Earlier versions have an issue with some links in the generated documentation website.

## Step-by-Step Guide

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
- Relationship visualizations
- Flow diagrams
- Control and metadata display

### 3. Run the Documentation Website

The generated website is a self-contained application. Install dependencies and start it:

```bash
cd docs/generated/ecommerce-docs
npm install
npm start
```

Open the URL shown in your terminal (usually `http://localhost:3000`) to browse your architecture documentation.

**Explore the website:**
- Navigate through different sections (nodes, relationships, flows, controls)
- Click on nodes to see their details
- View flow sequence diagrams

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

**Rule of thumb:** Use VSCode for development; use the website for sharing.

### 5. Consider Your Publishing Strategy

Think about how you would publish this website in your organization:

- **GitHub Pages:** Free, automatic from a branch
- **Internal static hosting:** Copy the built files to any web server
- **CI/CD integration:** Regenerate docs automatically when architecture changes

> **Tip:** Add docify to your CI/CD pipeline so documentation is always up-to-date with your architecture.

### 6. Commit Your Work

```bash
git add docs/generated/ README.md
git commit -m "Day 11: Generate shareable documentation website"
git tag day-11
```

## Key Concepts

### `calm docify` Command

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --output docs/generated/ecommerce-docs
```

| Flag | Purpose |
|------|---------|
| `--architecture` / `-a` | Path to your CALM architecture JSON |
| `--output` / `-o` | Directory where the website will be generated |
| `--template` / `-t` | (Optional) Path to a Handlebars template for single-file output |

### What the Website Contains

The generated website includes:
- **Overview page** — architecture name, description, ADR links
- **Node pages** — per-node detail with interfaces, metadata, and controls
- **Relationship pages** — connection details with source/destination interface references
- **Flow pages** — sequence diagrams rendered from your flow definitions
- **Control pages** — NFRs with requirement URLs and configurations

### Website vs CLI Preview

The `calm docify` website is functionally equivalent to the VSCode extension preview, but packaged as a standalone static site that requires no tooling to view.

## Resources

- [Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)

## Next Steps

In the [next tutorial](./12-calm-widgets), you'll learn how to create custom documentation templates using CALM Widgets — the same building blocks that power this website!
