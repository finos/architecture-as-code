// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllPacks } from '@calmstudio/extensions';
import { renderELKDiagram } from './elkRender.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

beforeAll(() => {
  initAllPacks();
});

const minimalArch: CalmArchitecture = {
  nodes: [
    {
      'unique-id': 'svc-a',
      'node-type': 'service',
      name: 'Service A',
      description: 'First service',
    },
    {
      'unique-id': 'svc-b',
      'node-type': 'database',
      name: 'Service B',
      description: 'Second service',
    },
  ],
  relationships: [
    {
      'unique-id': 'rel-1',
      'relationship-type': 'connects',
      source: 'svc-a',
      destination: 'svc-b',
      protocol: 'HTTPS',
    },
  ],
};

const awsArch: CalmArchitecture = {
  nodes: [
    {
      'unique-id': 'lambda-1',
      'node-type': 'aws:lambda',
      name: 'My Lambda',
      description: 'AWS Lambda function',
    },
    {
      'unique-id': 's3-1',
      'node-type': 'aws:s3',
      name: 'My Bucket',
      description: 'S3 storage bucket',
    },
  ],
  relationships: [
    {
      'unique-id': 'rel-aws-1',
      'relationship-type': 'connects',
      source: 'lambda-1',
      destination: 's3-1',
    },
  ],
};

const coreTypesArch: CalmArchitecture = {
  nodes: [
    { 'unique-id': 'n-actor', 'node-type': 'actor', name: 'User', description: 'Human actor' },
    { 'unique-id': 'n-system', 'node-type': 'system', name: 'System', description: 'Sys' },
    { 'unique-id': 'n-service', 'node-type': 'service', name: 'Svc', description: 'Service' },
    { 'unique-id': 'n-db', 'node-type': 'database', name: 'DB', description: 'Database' },
  ],
  relationships: [
    {
      'unique-id': 'r-1',
      'relationship-type': 'connects',
      source: 'n-actor',
      destination: 'n-system',
    },
  ],
};

const emptyArch: CalmArchitecture = {
  nodes: [],
  relationships: [],
};

describe('renderELKDiagram', () => {
  it('Test 1: returns SVG string containing rect elements with pack colors for extension nodes', async () => {
    const svg = await renderELKDiagram(awsArch, { theme: 'light' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('<rect');
    // AWS pack color should appear (compute color bg or stroke)
    expect(svg).toContain('#fff3e0'); // AWS compute bg OR
    // At least it should have node rects
    expect(svg).toContain('</svg>');
  });

  it('Test 2: returns SVG with edge polylines/paths connecting source to destination', async () => {
    const svg = await renderELKDiagram(minimalArch);
    expect(svg).toContain('<svg');
    // Should have either polyline or path for edges
    const hasPolyline = svg.includes('<polyline');
    const hasPath = svg.includes('<path');
    expect(hasPolyline || hasPath).toBe(true);
  });

  it('Test 3: returns SVG containing icon SVG content or indicator for pack nodes', async () => {
    const svg = await renderELKDiagram(awsArch);
    expect(svg).toContain('<svg');
    // Should have text elements at minimum (icon or badge)
    expect(svg).toContain('<text');
  });

  it('Test 4: returns SVG with correct node labels (name text element)', async () => {
    const svg = await renderELKDiagram(minimalArch);
    expect(svg).toContain('Service A');
    expect(svg).toContain('Service B');
  });

  it('Test 5: handles empty architecture gracefully with placeholder SVG', async () => {
    const svg = await renderELKDiagram(emptyArch);
    expect(svg).toContain('<svg');
    expect(svg).toContain('No nodes');
    expect(svg).toContain('</svg>');
  });

  it('Test 6: renders core node types with distinct colors', async () => {
    const svg = await renderELKDiagram(coreTypesArch);
    // Actor is blue (#4A90D9), database is purple (#9B59B6), etc.
    expect(svg).toContain('#4A90D9'); // actor
    expect(svg).toContain('#9B59B6'); // database
    expect(svg).toContain('</svg>');
  });
});
