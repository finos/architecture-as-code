// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchitecture } from '../tools/architecture.js';
import {
  addRelationship,
  getRelationship,
  updateRelationship,
  deleteRelationship
} from '../tools/relationships.js';

let tmpDir: string;
let filePath: string;

/** Build a nested CALM 1.2 `connects` relationship literal. */
function connects(id: string, source: string, destination: string) {
  return {
    'unique-id': id,
    'relationship-type': {
      connects: {
        source: { node: source },
        destination: { node: destination }
      }
    }
  };
}

/** Build a nested CALM 1.2 `interacts` relationship literal. */
function interacts(id: string, actor: string, ...nodes: string[]) {
  return {
    'unique-id': id,
    'relationship-type': {
      interacts: { actor, nodes }
    }
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-rels-test-'));
  filePath = join(tmpDir, 'test.calm');
  // Seed with two nodes and one relationship
  createArchitecture({
    nodes: [
      { 'unique-id': 'node-a', 'node-type': 'service', name: 'Service A' },
      { 'unique-id': 'node-b', 'node-type': 'service', name: 'Service B' }
    ],
    relationships: [connects('rel-existing', 'node-a', 'node-b')],
    file: filePath
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('add_relationship tool', () => {
  it('appends relationship and writes to file', () => {
    const result = addRelationship({
      relationship: interacts('rel-new', 'node-a', 'node-b'),
      file: filePath
    });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('rel-new');

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.relationships).toHaveLength(2);
  });

  it('rejects dangling source ref', () => {
    const result = addRelationship({
      relationship: connects('rel-bad', 'ghost-node', 'node-b'),
      file: filePath
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('ghost-node');
    expect(result.content[0]!.text).toContain('node-a');

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.relationships).toHaveLength(1);
  });

  it('rejects dangling destination ref', () => {
    const result = addRelationship({
      relationship: connects('rel-bad', 'node-a', 'ghost-node'),
      file: filePath
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('ghost-node');

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.relationships).toHaveLength(1);
  });
});

describe('get_relationship tool', () => {
  it('returns relationship by unique-id', () => {
    const result = getRelationship({ id: 'rel-existing', file: filePath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain('rel-existing');
    expect(result.content[0]!.text).toContain('node-a');
    expect(result.content[0]!.text).toContain('node-b');
  });

  it('returns error for unknown relationship', () => {
    const result = getRelationship({ id: 'unknown-rel', file: filePath });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('not found');
    expect(result.content[0]!.text).toContain('rel-existing');
  });
});

describe('update_relationship tool', () => {
  it('modifies relationship fields (merge, not replace)', () => {
    const result = updateRelationship({
      id: 'rel-existing',
      updates: { description: 'New description', protocol: 'HTTPS' },
      file: filePath
    });

    expect(result.isError).toBe(false);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    const rel = written.relationships.find(
      (r: { 'unique-id': string }) => r['unique-id'] === 'rel-existing'
    );
    expect(rel.description).toBe('New description');
    expect(rel.protocol).toBe('HTTPS');
    // Variant preserved through merge
    expect(rel['relationship-type'].connects.source.node).toBe('node-a');
    expect(rel['relationship-type'].connects.destination.node).toBe('node-b');
  });

  it('returns error for unknown relationship', () => {
    const result = updateRelationship({ id: 'ghost', updates: { description: 'X' }, file: filePath });
    expect(result.isError).toBe(true);
  });
});

describe('delete_relationship tool', () => {
  it('removes relationship by ID without affecting others', () => {
    addRelationship({
      relationship: interacts('rel-second', 'node-a', 'node-b'),
      file: filePath
    });

    const result = deleteRelationship({ id: 'rel-existing', file: filePath });

    expect(result.isError).toBe(false);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.relationships).toHaveLength(1);
    expect(written.relationships[0]['unique-id']).toBe('rel-second');
  });

  it('returns error for unknown relationship', () => {
    const result = deleteRelationship({ id: 'ghost', file: filePath });
    expect(result.isError).toBe(true);
  });
});
