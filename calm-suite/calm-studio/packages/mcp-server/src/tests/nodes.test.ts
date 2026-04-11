// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchitecture } from '../tools/architecture.js';
import {
  addNode,
  getNode,
  updateNode,
  deleteNode,
  queryNodes,
  batchCreateNodes
} from '../tools/nodes.js';

let tmpDir: string;
let filePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-nodes-test-'));
  filePath = join(tmpDir, 'test.calm');
  // Seed with base architecture
  createArchitecture({
    nodes: [
      { 'unique-id': 'node-1', 'node-type': 'service', name: 'API Service' },
      { 'unique-id': 'node-2', 'node-type': 'database', name: 'Main DB' }
    ],
    relationships: [
      {
        'unique-id': 'rel-1',
        'relationship-type': 'connects',
        source: 'node-1',
        destination: 'node-2'
      }
    ],
    file: filePath
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('add_node tool', () => {
  it('appends node and writes to file', () => {
    const result = addNode({
      node: { 'unique-id': 'node-3', 'node-type': 'actor', name: 'User' },
      file: filePath
    });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('node-3');

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.nodes).toHaveLength(3);
    expect(written.nodes[2]['unique-id']).toBe('node-3');
  });
});

describe('get_node tool', () => {
  it('returns matching node details', () => {
    const result = getNode({ id: 'node-1', file: filePath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('API Service');
    expect(result.content[0]!.text).toContain('node-1');
  });

  it('returns error for unknown node', () => {
    const result = getNode({ id: 'unknown', file: filePath });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('not found');
    expect(result.content[0]!.text).toContain('node-1');  // lists available IDs
  });
});

describe('update_node tool', () => {
  it('modifies node fields (merge, not replace)', () => {
    const result = updateNode({
      id: 'node-1',
      updates: { name: 'Updated API', description: 'new description' },
      file: filePath
    });

    expect(result.isError).toBe(false);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    const node = written.nodes.find((n: { 'unique-id': string }) => n['unique-id'] === 'node-1');
    expect(node.name).toBe('Updated API');
    expect(node.description).toBe('new description');
    expect(node['node-type']).toBe('service'); // preserved original field
  });

  it('returns error for unknown node', () => {
    const result = updateNode({ id: 'unknown', updates: { name: 'X' }, file: filePath });
    expect(result.isError).toBe(true);
  });
});

describe('delete_node tool', () => {
  it('removes node and cascades to its relationships', () => {
    const result = deleteNode({ id: 'node-1', file: filePath });

    expect(result.isError).toBe(false);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.nodes).toHaveLength(1);
    expect(written.nodes[0]['unique-id']).toBe('node-2');
    // rel-1 references node-1 as source — should be deleted
    expect(written.relationships).toHaveLength(0);
  });

  it('returns error for unknown node', () => {
    const result = deleteNode({ id: 'ghost', file: filePath });
    expect(result.isError).toBe(true);
  });
});

describe('query_nodes tool', () => {
  it('filters by type', () => {
    const result = queryNodes({ type: 'service', file: filePath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('API Service');
    expect(result.content[0]!.text).not.toContain('Main DB');
  });

  it('filters by name substring (case-insensitive)', () => {
    const result = queryNodes({ name: 'api', file: filePath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('API Service');
    expect(result.content[0]!.text).not.toContain('Main DB');
  });

  it('returns all nodes when no filter given', () => {
    const result = queryNodes({ file: filePath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('node-1');
    expect(result.content[0]!.text).toContain('node-2');
  });
});

describe('batch_create_nodes tool', () => {
  it('adds multiple nodes in one call and returns count', () => {
    const result = batchCreateNodes({
      nodes: [
        { 'unique-id': 'node-10', 'node-type': 'service', name: 'Service A' },
        { 'unique-id': 'node-11', 'node-type': 'service', name: 'Service B' },
        { 'unique-id': 'node-12', 'node-type': 'actor', name: 'Admin' }
      ],
      file: filePath
    });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('3');

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.nodes).toHaveLength(5); // 2 original + 3 new
  });
});
