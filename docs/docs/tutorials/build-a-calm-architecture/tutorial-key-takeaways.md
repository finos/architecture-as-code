---
id: tutorial-key-takeaways
title: Tutorial Key Takeaways
sidebar_position: 6
---


## Tutorial Summary

### What was accomplished in the tutorial (high level)

- Established a repeatable workflow: take business context → propose CALM nodes/flows → review/approve changes → update architecture JSON → validate with `calm validate`.
- Built a concrete example architecture for an event-driven trading system (nodes: UI, services, event bus, datastores, actor).
- Added technical interface specifications for REST endpoints and example flows (submit trade, process trade events, bootstrap data).
- Applied controls and metadata (encryption controls, versioning, data-classification) and demonstrated how to represent them in CALM.
- Generated human-readable documentation: both a Docusaurus site (HTML) and a templated Markdown view using CALM’s docify/template tooling.
- Demonstrated safe AI collaboration patterns: review/approve guardrails, validation steps, and commit checkpoints.

### Good Practices — Working with CALM and the AI Assistant

- **Prompt Precision**: Use clear, scoped prompts that reference the specific source (for example, a section in business-context.md) and the exact output format you want (nodes, JSON fragment, interfaces). This reduces hallucination and speeds iteration.

- **Human-in-the-loop**: Treat AI suggestions as drafts. Always review and approve changes before applying them to canonical files (the tutorial models this by requiring architect approval for node additions and metadata).

- **Validate Early and Often**: Run `calm validate -a <file>` after each automated modification to catch schema or structural issues immediately. Make validation part of every change workflow.

- **Keep Atomic Commits**: Commit meaningful checkpoints (e.g., "initial architecture", "add interfaces", "add controls") so changes are traceable and reversible.

- **Use Templates for Repeatability**: Keep canonical templates (e.g., `solution-architecture-document.md`) in a versioned location. When using custom templates with `calm docify`, verify that external references resolve (or provide local fallbacks) to avoid dereference failures.

- **Document Non-functional Requirements in CALM**: Represent controls (encryption, auth, retention) and important metadata at the architecture or node-level so they travel with the model and become part of generated documentation.

- **AI Guardrails & Reproducibility**:
  - Ask the AI to show diffs or proposed JSON snippets before applying changes.
  - Require `calm validate` after AI edits and include the validation output in the change log.

- **Use the CALM VSCode extension for fast reviews**: To preview and interactively inspect CALM JSON files inside your editor. Key benefits and a simple workflow:
  - Preview & validate: Open your architecture JSON and use the extension's preview pane to render the model and run inline validation before saving.
  - Quick diffs: Use VSCode's Source Control diff UI together with the extension preview to compare prior and current renders (helps spot unintended structural changes).
  
