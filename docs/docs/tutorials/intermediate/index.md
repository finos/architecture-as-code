---
id: intermediate-tutorials
title: 🟡 Intermediate Tutorials
sidebar_position: 1
---

# 🟡 Intermediate Tutorials

**Prerequisite: Complete the [Beginner Tutorials](../beginner/) section first**

Welcome to the intermediate tutorials! These thirteen tutorials build on your e-commerce architecture from the Beginner section, introducing controls, flows, documentation generation, AI-assisted design, and governance with Patterns and Standards.

## What You'll Learn

| Tutorial | What You'll Master |
|----------|-------------------|
| [Controls for NFRs](./08-controls) | Document security, compliance, and performance requirements |
| [Business Flows](./09-business-flows) | Map business processes to architecture components |
| [Link ADRs](./10-adr-linking) | Connect architectural decisions to your architecture |
| [Share as a Website](./11-docify) | Generate a shareable documentation website |
| [CALM Widgets](./12-calm-widgets) | Create custom docs with the widget framework |
| [Handlebars Templates](./13-handlebars-templates) | Advanced custom documentation with full template control |
| [Architecture Advisor](./14-ai-advisor) | Use AI to identify and fix resilience weaknesses |
| [Operations Advisor](./15-ops-advisor) | Enrich architecture with operational metadata for incident response |
| [Generate Ops Docs](./16-ops-docs) | Auto-generate runbooks and on-call guides from architecture data |
| [CALM Patterns](./17-patterns) | Define and use reusable architecture templates |
| [Organizational Standards](./18-standards) | Extend CALM with your organization's required properties |
| [Enforcing Standards](./19-enforcing-standards) | Wire Standards into Patterns for automated compliance |
| [Multi-Pattern Validation](./20-multi-pattern-validation) | Validate one architecture against multiple patterns |

## Prerequisites

Before starting, ensure you have:

- Completed all **[Beginner Tutorials](../beginner/)**, particularly the capstone [Complete Architecture](../beginner/07-complete-architecture) tutorial
- Your `ecommerce-platform.json` architecture file from the Beginner section
- The CALM CLI installed and verified with `calm --version`
- VSCode with the CALM Tools extension installed

## Time Commitment

Each tutorial takes approximately **30-60 minutes** to complete. The AI-assisted tutorials (Days 14–16) may vary depending on how deeply you explore the recommendations.

## Getting Started

Ready to begin? [Start with Controls for NFRs →](./08-controls)

## Learning Path

```
Controls for NFRs
    │
    ▼
Business Flows ────────────────► "I can model business processes!"
    │
    ▼
Link ADRs ─────────────────────► "I can trace decisions to architecture!"
    │
    ▼
Share as a Website ────────────► "I can publish architecture docs!"
    │
    ▼
CALM Widgets ──────────────────► "I can create custom visualisations!"
    │
    ▼
Handlebars Templates ──────────► "I have full template control!"
    │
    ▼
Architecture Advisor ──────────► "I can improve resilience with AI!"
    │
    ▼
Operations Advisor ────────────► "My architecture is an ops manual!"
    │
    ▼
Generate Ops Docs ─────────────► "Docs auto-generate from architecture!"
    │
    ▼
CALM Patterns ─────────────────► "I can enforce reusable structures!"
    │
    ▼
Organizational Standards ──────► "I can mandate org-wide properties!"
    │
    ▼
Enforcing Standards ───────────► "Standards are automatically checked!"
    │
    ▼
Multi-Pattern Validation ──────► "I can apply layered governance!"
    │
    ▼
🎯 Ready to govern architectures at organizational scale!
```

## Tips for Success

1. **Work through tutorials in order** — Each one builds directly on the previous
2. **Keep your `ecommerce-platform.json`** — Most tutorials evolve this same file
3. **Use CALM Chat mode** — The AI assistant accelerates implementation
4. **Validate frequently** — Run `calm validate -a architectures/ecommerce-platform.json` after each change
5. **Commit as you go** — Each tutorial includes a commit command; use it to build a clear history
