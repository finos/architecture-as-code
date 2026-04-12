---
sidebar_position: 1
title: Introduction
---

# CalmStudio

CalmStudio is a visual architecture editor for the [FINOS CALM](https://calm.finos.org/release/1.2/) (Common Architecture Language Model) standard. It lets architects design system diagrams visually while generating validated, production-ready architecture-as-code automatically.

## What is CalmStudio?

Architecture diagrams are often disconnected from the systems they describe — they drift, become stale, and lose trust. CalmStudio solves this by making the CALM JSON document the single source of truth: every node you draw on the canvas corresponds to a typed, validated CALM element, and every connection is a typed relationship.

**CalmStudio turns visual architecture into code. Automatically.**

## Key Features

- **Visual canvas editor** — Drag-and-drop nodes and relationships with a rich palette of architecture building blocks
- **Bidirectional sync** — Canvas and CALM JSON stay in sync; edit either and the other updates instantly
- **Extension packs** — Built-in support for AWS, Azure, GCP, Kubernetes, FluxNova, and AI services; write custom packs in TypeScript
- **MCP server** — 21 Model Context Protocol tools let AI assistants create and query architectures via natural language
- **AIGF governance** — Integrated AI Governance Framework controls with CALM 1.2 compliance validation
- **C4 view mode** — Hierarchical zoom from context → container → component using CALM containment relationships
- **Template picker** — Start from curated architecture templates instead of a blank canvas

## Part of the FINOS Ecosystem

CalmStudio is built on FINOS CALM and integrates with the broader FINOS open source ecosystem:

- [CALM Specification 1.2](https://calm.finos.org/release/1.2/) — The architecture language standard
- [architecture-as-code](https://github.com/finos/architecture-as-code) — Reference implementations and tooling
- [AI Governance Framework (AIGF)](https://air-governance-framework.finos.org/) — Governance controls for AI systems

## Getting Started

- **New to CalmStudio?** Start with the [Quick Start Guide](/docs/getting-started/quick-start) — you'll have an architecture drawn and exported in 5 minutes.
- **Integrating with AI?** See the [MCP Server Guide](/docs/developer-guide/mcp-server).
- **Building extension packs?** See the [Extension Packs Guide](/docs/developer-guide/extension-packs).
- **Contributing?** See the [Contributor Guide](/docs/developer-guide/contributing).
