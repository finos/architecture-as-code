// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateArchitectureTool } from '../tools/render.js';

const tmpFile = join(tmpdir(), `validate-test-${Date.now()}.calm`);

afterEach(() => {
  try { unlinkSync(tmpFile); } catch { /* ignore */ }
});

describe('validate_architecture tool (dedicated)', () => {
  it('returns empty / no issues for valid architecture', () => {
    const arch = {
      nodes: [
        { 'unique-id': 'a', 'node-type': 'system', name: 'Alpha', description: 'The Alpha system' },
        { 'unique-id': 'b', 'node-type': 'service', name: 'Beta', description: 'The Beta service' }
      ],
      relationships: [
        { 'unique-id': 'r1', 'relationship-type': 'connects', source: 'a', destination: 'b' }
      ]
    };
    writeFileSync(tmpFile, JSON.stringify(arch, null, 2), 'utf-8');
    const result = validateArchitectureTool({ file: tmpFile });
    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toBe('No validation issues found.');
  });

  it('returns error for dangling ref in relationship', () => {
    const arch = {
      nodes: [{ 'unique-id': 'x', 'node-type': 'system', name: 'X' }],
      relationships: [
        { 'unique-id': 'r1', 'relationship-type': 'connects', source: 'x', destination: 'ghost' }
      ]
    };
    writeFileSync(tmpFile, JSON.stringify(arch, null, 2), 'utf-8');
    const result = validateArchitectureTool({ file: tmpFile });
    const text = result.content[0]!.text;
    expect(text).toContain('[ERROR]');
    expect(text).toContain('ghost');
  });

  it('returns error for duplicate node IDs', () => {
    const arch = {
      nodes: [
        { 'unique-id': 'same-id', 'node-type': 'system', name: 'First' },
        { 'unique-id': 'same-id', 'node-type': 'service', name: 'Second' }
      ],
      relationships: []
    };
    writeFileSync(tmpFile, JSON.stringify(arch, null, 2), 'utf-8');
    const result = validateArchitectureTool({ file: tmpFile });
    const text = result.content[0]!.text;
    expect(text).toContain('[ERROR]');
    expect(text).toContain('same-id');
  });

  it('returns warning for orphan node', () => {
    const arch = {
      nodes: [
        { 'unique-id': 'lone', 'node-type': 'database', name: 'Lone DB' }
      ],
      relationships: []
    };
    writeFileSync(tmpFile, JSON.stringify(arch, null, 2), 'utf-8');
    const result = validateArchitectureTool({ file: tmpFile });
    const text = result.content[0]!.text;
    expect(text).toContain('[WARNING]');
    expect(text).toContain('lone');
  });
});
