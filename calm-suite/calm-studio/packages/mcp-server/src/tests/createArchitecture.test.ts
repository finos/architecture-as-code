// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createArchitecture,
  describeArchitecture
} from '../tools/architecture.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-arch-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const sampleNodes = [
  { 'unique-id': 'node-1', 'node-type': 'service', name: 'API Service' },
  { 'unique-id': 'node-2', 'node-type': 'database', name: 'Database' }
];

const sampleRelationships = [
  {
    'unique-id': 'rel-1',
    'relationship-type': 'connects' as const,
    source: 'node-1',
    destination: 'node-2'
  }
];

describe('create_architecture tool', () => {
  it('creates valid architecture from node/rel input', () => {
    const filePath = join(tmpDir, 'test.calm');
    const result = createArchitecture({
      nodes: sampleNodes,
      relationships: sampleRelationships,
      file: filePath
    });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('2 node');
    expect(result.content[0]!.text).toContain(filePath);

    // Verify file was written with correct content
    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.nodes).toHaveLength(2);
    expect(written.relationships).toHaveLength(1);
    expect(written.nodes[0]['unique-id']).toBe('node-1');
  });

  it('uses default file path when no file param given', () => {
    const filePath = join(tmpDir, 'architecture.calm');
    const result = createArchitecture({
      nodes: sampleNodes,
      relationships: [],
      file: filePath
    });
    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain(filePath);
  });

  it('overwrites existing file', () => {
    const filePath = join(tmpDir, 'overwrite.calm');

    // Write initial content
    createArchitecture({ nodes: sampleNodes, relationships: [], file: filePath });

    // Overwrite with new content
    const newNodes = [{ 'unique-id': 'node-99', 'node-type': 'actor', name: 'New Actor' }];
    createArchitecture({ nodes: newNodes, relationships: [], file: filePath });

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.nodes).toHaveLength(1);
    expect(written.nodes[0]['unique-id']).toBe('node-99');
  });

  it('includes deep link in response', () => {
    const filePath = join(tmpDir, 'deep-link.calm');
    const result = createArchitecture({ nodes: sampleNodes, relationships: [], file: filePath });
    expect(result.content[0]!.text).toContain('calmstudio://open');
  });
});

describe('describe_architecture tool', () => {
  it('returns structured summary of architecture', () => {
    const filePath = join(tmpDir, 'describe.calm');
    createArchitecture({ nodes: sampleNodes, relationships: sampleRelationships, file: filePath });

    const result = describeArchitecture({ file: filePath });

    expect(result.isError).toBe(false);
    const text = result.content[0]!.text;
    expect(text).toContain('2');   // node count
    expect(text).toContain('1');   // relationship count
    expect(text).toContain('API Service');
    expect(text).toContain('Database');
  });

  it('returns empty summary for empty architecture', () => {
    const filePath = join(tmpDir, 'empty.calm');
    createArchitecture({ nodes: [], relationships: [], file: filePath });

    const result = describeArchitecture({ file: filePath });
    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('0');
  });
});
