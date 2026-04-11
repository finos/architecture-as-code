// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * End-to-end integration test for the MCP server tool handlers.
 *
 * Exercises the full CALM workflow by calling pure logic functions directly
 * (no MCP transport involved) to verify protocol compliance and correct outputs.
 *
 * Workflow: create_architecture → add_node → add_relationship (dangling) →
 *           add_relationship (valid) → validate → describe → render_diagram →
 *           export_calm → import_calm
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createArchitecture, describeArchitecture } from '../tools/architecture.js';
import { addNode } from '../tools/nodes.js';
import { addRelationship } from '../tools/relationships.js';
import { validateArchitectureTool, renderDiagram } from '../tools/render.js';
import { readCalmGuide } from '../tools/guide.js';
import { exportCalm, importCalm } from '../tools/io.js';

let tmpDir: string;
let archFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-e2e-test-'));
  archFile = join(tmpDir, 'e2e.calm');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper to assert correct MCP response format
// ---------------------------------------------------------------------------

function assertToolSuccess(result: ReturnType<typeof createArchitecture>, hint = '') {
  expect(result, `${hint}: result should exist`).toBeDefined();
  expect(result.content, `${hint}: content array missing`).toBeDefined();
  expect(result.content.length, `${hint}: content empty`).toBeGreaterThan(0);
  expect(result.content[0]!.type, `${hint}: content[0].type`).toBe('text');
  expect(result.isError, `${hint}: should not be error`).toBeFalsy();
  return result.content[0]!.text as string;
}

function assertToolError(result: ReturnType<typeof createArchitecture>, hint = '') {
  expect(result, `${hint}: result should exist`).toBeDefined();
  expect(result.content, `${hint}: content array missing`).toBeDefined();
  expect(result.content.length, `${hint}: content empty`).toBeGreaterThan(0);
  expect(result.content[0]!.type, `${hint}: content[0].type`).toBe('text');
  expect(result.isError, `${hint}: should be error`).toBe(true);
  return result.content[0]!.text as string;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: read_calm_guide', () => {
  it('returns CALM reference text', () => {
    const result = readCalmGuide({});
    const text = assertToolSuccess(result, 'read_calm_guide');
    expect(text).toContain('CALM Architecture Reference Guide');
    expect(text).toContain('actor');
    expect(text).toContain('connects');
    expect(text).toContain('create_architecture');
  });
});

describe('E2E: create_architecture → add_node → add_relationship → validate → describe → render → export → import', () => {
  it('step 1: create_architecture with 3 nodes and 2 relationships', () => {
    const result = createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' },
        { 'unique-id': 'db-1', 'node-type': 'database', name: 'PostgreSQL' }
      ],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': 'interacts',
          source: 'actor-1',
          destination: 'svc-1',
          protocol: 'HTTPS'
        },
        {
          'unique-id': 'rel-2',
          'relationship-type': 'connects',
          source: 'svc-1',
          destination: 'db-1',
          protocol: 'TCP'
        }
      ]
    });
    const text = assertToolSuccess(result, 'create_architecture');
    expect(text).toContain('3 nodes');
    expect(text).toContain('2 relationships');
    expect(existsSync(archFile)).toBe(true);
  });

  it('step 2: add_node adds a 4th node', () => {
    // Prerequisite: create arch
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' },
        { 'unique-id': 'db-1', 'node-type': 'database', name: 'PostgreSQL' }
      ],
      relationships: []
    });

    const result = addNode({
      file: archFile,
      node: { 'unique-id': 'cache-1', 'node-type': 'database', name: 'Redis Cache' }
    });
    const text = assertToolSuccess(result, 'add_node');
    expect(text).toContain('cache-1');
    expect(text).toContain('Redis Cache');
  });

  it('step 3: add_relationship with dangling ref returns isError: true', () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' }
      ],
      relationships: []
    });

    const result = addRelationship({
      file: archFile,
      relationship: {
        'unique-id': 'dangling-rel',
        'relationship-type': 'connects',
        source: 'svc-1',
        destination: 'nonexistent-node'
      }
    });
    const text = assertToolError(result, 'add_relationship dangling');
    expect(text).toContain('nonexistent-node');
  });

  it('step 4: add_relationship (valid) adds a relationship to new node', () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' },
        { 'unique-id': 'cache-1', 'node-type': 'database', name: 'Redis Cache' }
      ],
      relationships: []
    });

    const result = addRelationship({
      file: archFile,
      relationship: {
        'unique-id': 'rel-cache',
        'relationship-type': 'connects',
        source: 'svc-1',
        destination: 'cache-1',
        protocol: 'TCP'
      }
    });
    const text = assertToolSuccess(result, 'add_relationship valid');
    expect(text).toContain('rel-cache');
    expect(text).toContain('svc-1');
    expect(text).toContain('cache-1');
  });

  it('step 5: validate_architecture returns no errors for valid arch', () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User', description: 'End user of the system' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway', description: 'Central API routing layer' },
        { 'unique-id': 'db-1', 'node-type': 'database', name: 'PostgreSQL', description: 'Primary relational database' }
      ],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': 'interacts',
          source: 'actor-1',
          destination: 'svc-1'
        },
        {
          'unique-id': 'rel-2',
          'relationship-type': 'connects',
          source: 'svc-1',
          destination: 'db-1'
        }
      ]
    });

    const result = validateArchitectureTool({ file: archFile });
    const text = assertToolSuccess(result, 'validate_architecture');
    expect(text).toContain('No validation issues');
  });

  it('step 6: describe_architecture returns summary with correct counts', () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' },
        { 'unique-id': 'db-1', 'node-type': 'database', name: 'PostgreSQL' }
      ],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': 'interacts',
          source: 'actor-1',
          destination: 'svc-1'
        }
      ]
    });

    const result = describeArchitecture({ file: archFile });
    const text = assertToolSuccess(result, 'describe_architecture');
    expect(text).toContain('3');
    expect(text).toContain('actor-1');
    expect(text).toContain('svc-1');
    expect(text).toContain('db-1');
    expect(text).toContain('API Gateway');
  });

  it('step 7: render_diagram returns SVG string containing <svg', async () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' }
      ],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': 'interacts',
          source: 'actor-1',
          destination: 'svc-1'
        }
      ]
    });

    const result = await renderDiagram({ file: archFile, direction: 'DOWN' });
    const text = assertToolSuccess(result, 'render_diagram');
    expect(text).toContain('<svg');
    expect(text).toContain('</svg>');
    expect(text).toContain('User');
    expect(text).toContain('API Gateway');
  });

  it('step 8: export_calm copies to new path, import_calm reads it back', () => {
    createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway' }
      ],
      relationships: []
    });

    const exportPath = join(tmpDir, 'exported.calm');
    const exportResult = exportCalm({ source: archFile, destination: exportPath });
    assertToolSuccess(exportResult, 'export_calm');
    expect(existsSync(exportPath)).toBe(true);

    const importResult = importCalm({ file: exportPath });
    const importText = assertToolSuccess(importResult, 'import_calm');
    expect(importText).toContain('Nodes: 2');
    expect(importText).toContain('Relationships: 0');
  });
});

describe('E2E: full workflow smoke test', () => {
  it('create → add node → add relationship → validate → render produces valid results', async () => {
    // 1. Create base architecture
    const step1 = createArchitecture({
      file: archFile,
      nodes: [
        { 'unique-id': 'actor-1', 'node-type': 'actor', name: 'User', description: 'End user' },
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Gateway', description: 'API routing' },
        { 'unique-id': 'db-1', 'node-type': 'database', name: 'PostgreSQL', description: 'Main database' }
      ],
      relationships: [
        {
          'unique-id': 'rel-1',
          'relationship-type': 'interacts',
          source: 'actor-1',
          destination: 'svc-1',
          protocol: 'HTTPS'
        },
        {
          'unique-id': 'rel-2',
          'relationship-type': 'connects',
          source: 'svc-1',
          destination: 'db-1',
          protocol: 'TCP'
        }
      ]
    });
    assertToolSuccess(step1, 'smoke: create_architecture');

    // 2. Add 4th node
    const step2 = addNode({
      file: archFile,
      node: { 'unique-id': 'cache-1', 'node-type': 'database', name: 'Redis Cache', description: 'In-memory cache layer' }
    });
    assertToolSuccess(step2, 'smoke: add_node');

    // 3. Dangling ref rejected
    const step3bad = addRelationship({
      file: archFile,
      relationship: {
        'unique-id': 'bad-rel',
        'relationship-type': 'connects',
        source: 'svc-1',
        destination: 'does-not-exist'
      }
    });
    expect(step3bad.isError).toBe(true);

    // 4. Valid relationship to new node
    const step4 = addRelationship({
      file: archFile,
      relationship: {
        'unique-id': 'rel-3',
        'relationship-type': 'connects',
        source: 'svc-1',
        destination: 'cache-1',
        protocol: 'TCP'
      }
    });
    assertToolSuccess(step4, 'smoke: add_relationship');

    // 5. Validate — no errors
    const step5 = validateArchitectureTool({ file: archFile });
    const validateText = assertToolSuccess(step5, 'smoke: validate');
    expect(validateText).toContain('No validation issues');

    // 6. Describe — correct counts (4 nodes, 3 rels)
    const step6 = describeArchitecture({ file: archFile });
    const describeText = assertToolSuccess(step6, 'smoke: describe');
    expect(describeText).toContain('4');
    expect(describeText).toContain('3');

    // 7. Render — valid SVG
    const step7 = await renderDiagram({ file: archFile, direction: 'DOWN' });
    const svgText = assertToolSuccess(step7, 'smoke: render');
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('</svg>');

    // 8. Export + Import roundtrip
    const exportPath = join(tmpDir, 'smoke-export.calm');
    assertToolSuccess(exportCalm({ source: archFile, destination: exportPath }), 'smoke: export');
    const importText = assertToolSuccess(importCalm({ file: exportPath }), 'smoke: import');
    expect(importText).toContain('Nodes: 4');
    expect(importText).toContain('Relationships: 3');
  });
});
