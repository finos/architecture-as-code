---
sidebar_position: 2
title: Getting Started
---

# Getting Started

Get CALMGuard running locally in under 5 minutes.

## Prerequisites

| Requirement | Minimum Version | Notes |
|------------|-----------------|-------|
| Node.js | 22+ | LTS recommended |
| npm | 10+ | Ships with Node 22 |
| Git | Any | For cloning |
| Google Gemini API key | — | Free tier sufficient for demo |

CalmGuard is the `calmguard` workspace inside the [`finos/architecture-as-code`](https://github.com/finos/architecture-as-code) monorepo. All commands run from the monorepo root.

## Installation

### 1. Clone the monorepo

```bash
git clone https://github.com/finos/architecture-as-code.git
cd architecture-as-code
```

### 2. Install dependencies

```bash
npm ci
```

This installs all workspaces (calm-guard, calm-studio, cli, server, etc.) from the root `package-lock.json`.

### 3. Configure environment variables

Create a `.env.local` file in `calm-guard/`:

```bash
# Required — Gemini is the default LLM provider
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key-here

# Optional — additional LLM providers
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

**Getting a Gemini API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key (free tier includes 15 requests/minute)
3. Copy the key to your `.env.local`

### 4. Start the development server

From the monorepo root:

```bash
npm run dev --workspace=calmguard
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Quick Start

Once the server is running:

1. **Navigate to the dashboard** — visit [http://localhost:3000](http://localhost:3000)
2. **Select a demo architecture** — choose "Trading Platform" or "Payment Gateway" from the dropdown
3. **Click "Analyze"** — watch the four AI agents stream their findings in real-time
4. **Explore the dashboard** — compliance scores, architecture graph, risk heat map, and pipeline configs appear as agents complete

The full analysis typically takes 30-60 seconds depending on your LLM provider's response time.

## Demo Architectures

Two demo architectures are bundled in the `examples/` directory:

| Architecture | Description | Nodes | Complexity |
|-------------|-------------|-------|------------|
| Trading Platform | Equities trading system with market data feeds, order matching, and regulatory reporting | 12 nodes | High |
| Payment Gateway | Payment processing with fraud detection, card networks, and settlement | 8 nodes | Medium |

Both include realistic CALM controls referencing PCI-DSS, SEC, and FINRA requirements, making them ideal for demonstrating compliance analysis.

## Next Steps

- [Uploading Your Own Architecture](/uploading-architectures) — use your own CALM document
- [Reading Reports](/reading-reports) — understand the dashboard panels
- [Architecture Overview](/architecture/system-overview) — developer documentation
