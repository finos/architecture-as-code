---
sidebar_position: 1
title: Creating Extension Packs
---

# Creating Extension Packs

Extension packs let you add custom node types to CalmStudio's palette. The 9 built-in CALM node types (`actor`, `system`, `service`, `database`, `network`, `webclient`, `ecosystem`, `ldap`, `data-asset`) cover general architectures, but domain-specific systems need richer vocabularies. CalmStudio ships 7 packs (CALM Core, AWS, GCP, Azure, Kubernetes, AI/Agentic, FluxNova) and lets you add more.

## What is a PackDefinition?

A `PackDefinition` is a TypeScript object that describes a group of related node types. It provides metadata (id, label, version, default color) and an array of `NodeTypeEntry` objects — one per node type.

```typescript
import type { PackDefinition } from '@calmstudio/extensions';

export const myPack: PackDefinition = {
  id: 'monitoring',              // unique short identifier
  label: 'Monitoring',           // display name in the palette
  version: '1.0.0',              // semantic version
  color: {                       // pack-level default color
    bg: '#fff8e1',
    border: '#f9a825',
    stroke: '#f57f17',
    badge: '[MON]',
  },
  nodes: [ /* NodeTypeEntry[] */ ],
};
```

Each `NodeTypeEntry` describes a single node type:

```typescript
export interface NodeTypeEntry {
  typeId: string;        // e.g. 'monitoring:prometheus'
  label: string;         // e.g. 'Prometheus'
  icon: string;          // inline SVG string (16x16 viewBox, stroke-based)
  color: PackColor;      // visual color for this node type
  description?: string;  // one-line description
  isContainer?: boolean; // true → renders as a large containment box
}
```

### typeId Convention

- **Core CALM types**: unprefixed — `actor`, `service`, `database`
- **Extension pack types**: `packId:typeName` — `aws:lambda`, `monitoring:prometheus`

This convention ensures type IDs are globally unique across packs.

## Step-by-Step: Create a Monitoring Pack

### 1. Create the Pack File

Create `packages/extensions/src/packs/monitoring.ts`:

```typescript
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';

const monColor: PackColor = {
  bg: '#fff8e1',
  border: '#f9a825',
  stroke: '#f57f17',
  badge: '[MON]',
};

export const monitoringPack: PackDefinition = {
  id: 'monitoring',
  label: 'Monitoring',
  version: '1.0.0',
  color: monColor,
  nodes: [
    {
      typeId: 'monitoring:prometheus',
      label: 'Prometheus',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v4l3 3" stroke-linecap="round"/>
      </svg>`,
      color: monColor,
      description: 'Open-source metrics collection and alerting system',
    },
    {
      typeId: 'monitoring:grafana',
      label: 'Grafana',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9" stroke-linecap="round"/>
      </svg>`,
      color: { ...monColor, border: '#e85d04', stroke: '#c44000' },
      description: 'Open-source analytics and monitoring platform',
    },
    {
      typeId: 'monitoring:alertmanager',
      label: 'AlertManager',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2l9 19H3L12 2Z" stroke-linejoin="round"/>
        <path d="M12 10v4M12 17h.01" stroke-linecap="round"/>
      </svg>`,
      color: monColor,
      description: 'Handles alerts from Prometheus and routes to notification receivers',
    },
  ],
};
```

### 2. Register the Pack

Open `packages/extensions/src/index.ts` and add your pack to the `initAllPacks()` function:

```typescript
import { monitoringPack } from './packs/monitoring.js';

export function initAllPacks(): PackDefinition[] {
  return [
    corePack,
    awsPack,
    gcpPack,
    azurePack,
    k8sPack,
    aiPack,
    fluxnovaPack,
    monitoringPack,  // ← add here
  ];
}
```

Also re-export it from the package:

```typescript
export { monitoringPack } from './packs/monitoring.js';
```

### 3. Verify the Pack Loads

Start the dev server and check the palette:

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and scroll the left palette to find the **Monitoring** section. You should see Prometheus, Grafana, and AlertManager nodes available to drag onto the canvas.

### 4. Add Types to Node Data

When a monitoring node is placed on the canvas, its `node-type` in the CALM JSON will be the `typeId` value:

```json
{
  "unique-id": "prometheus-01",
  "node-type": "monitoring:prometheus",
  "name": "Prometheus",
  "description": "Scrapes metrics from all services"
}
```

Extension pack `node-type` values follow the `packId:typeName` format, which is valid in CALM 1.2 and passes validation.

## Icon Guidelines

Icons are inline SVG strings rendered at 16x16 (with a 24-unit viewBox). Follow these conventions to match the existing pack aesthetics:

- Use `viewBox="0 0 24 24"` with `width="16" height="16"`
- Use `fill="none"` with `stroke="currentColor"` and `stroke-width="1.5"`
- Use `stroke-linecap="round"` and `stroke-linejoin="round"` on paths
- Keep icons simple — single paths, circles, or minimal geometry
- Test at 16×16 — complex icons become illegible at small sizes

For cloud provider packs, you can import pre-made icons:

```typescript
import { awsIcons } from '../icons/aws.js';

// Use icon by key:
icon: awsIcons['lambda'] ?? awsIcons['ec2']!,
```

## Container Nodes

Set `isContainer: true` on a `NodeTypeEntry` to make the node render as a large resizable box that can contain other nodes. Use this for:

- Cloud provider VPCs, subnets, regions
- Kubernetes namespaces, clusters
- Logical groupings (ecosystems, deployment environments)

```typescript
{
  typeId: 'monitoring:dashboard-group',
  label: 'Dashboard Group',
  icon: '...',
  color: monColor,
  description: 'Logical grouping of Grafana dashboards',
  isContainer: true,  // ← renders as a container box
}
```

## PackDefinition Type Reference

The full `PackDefinition` and `NodeTypeEntry` types are exported from `@calmstudio/extensions`:

```typescript
import type { PackDefinition, NodeTypeEntry, PackColor } from '@calmstudio/extensions';
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Short unique identifier (`kebab-case`) |
| `label` | `string` | Yes | Display name in the palette |
| `version` | `string` | Yes | Semantic version (e.g. `"1.0.0"`) |
| `color` | `PackColor` | Yes | Pack-level default color |
| `nodes` | `NodeTypeEntry[]` | Yes | All node type entries in this pack |

| `PackColor` field | Type | Description |
|-------------------|------|-------------|
| `bg` | `string` | Background fill (CSS hex or color) |
| `border` | `string` | Border/stroke color |
| `stroke` | `string` | Darker stroke for icon rendering |
| `badge` | `string` (optional) | Short tag shown on node (e.g. `[AWS]`) |

## Real Examples

Study the built-in packs in `packages/extensions/src/packs/` as references:

- `core.ts` — 9 CALM core types with inline SVG icons
- `aws.ts` — 33 AWS services with color families by service category and pre-made icons
- `k8s.ts` — Kubernetes resource types including container nodes (Namespace, Cluster)
- `ai.ts` — AI/Agentic types (LLM, Agent, Vector Store, MCP Server, Tool)

The `PackDefinition` interface is also part of the published `@calmstudio/extensions` npm package — external developers can create packs for their own tools without forking CalmStudio.
