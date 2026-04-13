// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchitecture } from '../tools/architecture.js';
import { exportCalm, importCalm } from '../tools/io.js';

let tmpDir: string;
let sourcePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-io-test-'));
  sourcePath = join(tmpDir, 'source.calm');
  createArchitecture({
    nodes: [
      { 'unique-id': 'node-1', 'node-type': 'service', name: 'My Service' }
    ],
    relationships: [],
    file: sourcePath
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('export_calm tool', () => {
  it('writes .calm content to destination path', () => {
    const destPath = join(tmpDir, 'exported.calm');
    const result = exportCalm({ source: sourcePath, destination: destPath });

    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toContain(destPath);

    const exported = JSON.parse(readFileSync(destPath, 'utf-8'));
    expect(exported.nodes).toHaveLength(1);
    expect(exported.nodes[0]['unique-id']).toBe('node-1');
  });

  it('round-trip: export then import gives identical content', () => {
    const exportedPath = join(tmpDir, 'roundtrip.calm');
    exportCalm({ source: sourcePath, destination: exportedPath });

    const importResult = importCalm({ file: exportedPath });

    expect(importResult.isError).toBe(false);
    const text = importResult.content[0]!.text;
    expect(text).toContain('1');  // node count
  });
});

describe('import_calm tool', () => {
  it('reads and parses valid .calm file', () => {
    const result = importCalm({ file: sourcePath });

    expect(result.isError).toBe(false);
    const text = result.content[0]!.text;
    expect(text).toContain('1');   // node count
    expect(text).toContain('0');   // relationship count
  });

  it('returns error for invalid JSON', () => {
    const badPath = join(tmpDir, 'bad.calm');
    writeFileSync(badPath, '{ not valid json ');
    const result = importCalm({ file: badPath });
    expect(result.isError).toBe(true);
  });

  it('returns error for missing nodes array', () => {
    const noNodesPath = join(tmpDir, 'nonodes.calm');
    writeFileSync(noNodesPath, JSON.stringify({ relationships: [] }));
    const result = importCalm({ file: noNodesPath });
    expect(result.isError).toBe(true);
  });
});
