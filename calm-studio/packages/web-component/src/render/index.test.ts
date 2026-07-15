// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderELKDiagram } from './index.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const fixture = {
  nodes: [
    { 'unique-id': 'web', 'node-type': 'actor', name: 'Web Client', description: 'Browser UI' },
    { 'unique-id': 'api', 'node-type': 'service', name: 'Trade API', description: 'Backend trade service' },
  ],
  relationships: [
    {
      'unique-id': 'web-to-api',
      'relationship-type': {
        connects: {
          source: { node: 'web' },
          destination: { node: 'api' },
        },
      },
      protocol: 'HTTPS',
    },
  ],
} as CalmArchitecture;

describe('render entry', () => {
  it('renders an SVG string in a Node environment (no customElements)', async () => {
    expect(typeof globalThis.customElements).toBe('undefined');
    const svg = await renderELKDiagram(fixture, { theme: 'light' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Web Client');
    expect(svg).toContain('Trade API');
  });

  it('produces different output for light and dark themes', async () => {
    const light = await renderELKDiagram(fixture, { theme: 'light' });
    const dark = await renderELKDiagram(fixture, { theme: 'dark' });
    expect(light).not.toEqual(dark);
  });

  it('renders nodes-only architecture (no relationships key) without crashing', async () => {
    const nodesOnly = {
      nodes: [
        { 'unique-id': 'solo', 'node-type': 'system', name: 'Solo System', description: 'Standalone' },
      ],
    } as unknown as CalmArchitecture;

    const svg = await renderELKDiagram(nodesOnly, { theme: 'light' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('Solo System');
  });

  it('renders fully empty architecture (no nodes/relationships keys) as the "No nodes" placeholder', async () => {
    const empty = {} as unknown as CalmArchitecture;

    const svg = await renderELKDiagram(empty, { theme: 'light' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('No nodes');
  });
});
