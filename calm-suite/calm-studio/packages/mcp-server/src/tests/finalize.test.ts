// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchitecture } from '../tools/architecture.js';
import { finalizeArchitecture } from '../tools/finalize.js';

let tmpDir: string;
let filePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-finalize-test-'));
  filePath = join(tmpDir, 'multi-agent.calm.json');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('finalize_architecture tool', () => {
  it('returns success on a valid architecture and writes AIGF decorator', async () => {
    createArchitecture({
      nodes: [
        { 'unique-id': 'agent-1', 'node-type': 'ai:agent', name: 'Trader Agent' },
        { 'unique-id': 'llm-1', 'node-type': 'ai:llm', name: 'Inference Endpoint' }
      ],
      relationships: [
        { 'unique-id': 'rel-1', 'relationship-type': 'interacts', source: 'agent-1', destination: 'llm-1' }
      ],
      file: filePath
    });

    // Strip AIGF decorator manually so finalize must put it back
    const before = JSON.parse(readFileSync(filePath, 'utf-8'));
    delete before.decorators;
    writeFileSync(filePath, JSON.stringify(before, null, 2));

    const result = await finalizeArchitecture({ file: filePath, render: false });

    expect(result.isError).toBe(false);
    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.validation.errors).toBe(0);
    expect(summary.aigf.decoratorAttached).toBe(true);
    expect(summary.aigf.aiNodeCount).toBe(2);
    expect(summary.rendered).toBeNull();

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.decorators).toHaveLength(1);
    expect(written.decorators[0]['unique-id']).toBe('aigf-governance-overlay');
  });

  it('reports validation errors but still writes the AIGF decorator', async () => {
    createArchitecture({
      nodes: [
        { 'unique-id': 'agent-1', 'node-type': 'ai:agent', name: 'Trader Agent' }
      ],
      relationships: [
        // dangling reference — destination does not exist
        { 'unique-id': 'rel-1', 'relationship-type': 'interacts', source: 'agent-1', destination: 'nonexistent' }
      ],
      file: filePath
    });

    const result = await finalizeArchitecture({ file: filePath, render: false });

    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.validation.errors).toBeGreaterThan(0);
    expect(summary.aigf.decoratorAttached).toBe(true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.decorators).toHaveLength(1);
  });

  it('does not attach a decorator when the architecture has no AI nodes', async () => {
    createArchitecture({
      nodes: [
        { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API' }
      ],
      relationships: [],
      file: filePath
    });

    const result = await finalizeArchitecture({ file: filePath, render: false });

    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.aigf.decoratorAttached).toBe(false);
    expect(summary.aigf.aiNodeCount).toBe(0);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(written.decorators).toBeUndefined();
  });

  it('renders SVG when render=true', async () => {
    createArchitecture({
      nodes: [
        { 'unique-id': 'agent-1', 'node-type': 'ai:agent', name: 'Trader Agent' }
      ],
      relationships: [],
      file: filePath
    });

    const result = await finalizeArchitecture({ file: filePath, render: true });

    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.rendered).toBeDefined();
    expect(summary.rendered).not.toBeNull();
    expect(typeof summary.rendered).toBe('string');
    // The rendered content should be SVG markup
    expect(summary.rendered.startsWith('<svg')).toBe(true);
  });

  it('is idempotent — re-running on the same file leaves contents stable', async () => {
    createArchitecture({
      nodes: [
        { 'unique-id': 'agent-1', 'node-type': 'ai:agent', name: 'Trader Agent' }
      ],
      relationships: [],
      file: filePath
    });

    await finalizeArchitecture({ file: filePath, render: false });
    const afterFirst = readFileSync(filePath, 'utf-8');

    // Force a deterministic clock so the assessment-date matches across calls
    await finalizeArchitecture({ file: filePath, render: false });
    const afterSecond = readFileSync(filePath, 'utf-8');

    // Both runs should produce the same content (assessment-date is same calendar day,
    // governance score is deterministic given the same nodes)
    expect(afterSecond).toBe(afterFirst);
  });
});
