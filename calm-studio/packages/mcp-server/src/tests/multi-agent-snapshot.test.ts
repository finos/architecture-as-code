// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Snapshot test for the canonical multi-agent ARB conversion.
 *
 * Loads the hand-curated CALM JSON for the FINOS Labs multi-agent reference
 * architecture (ma_ref_arch_jan_2026.md), runs finalize_architecture against
 * it, and asserts that the converted artifact:
 *
 *   - validates with zero errors against the CALM 1.2 schema
 *   - has the AIGF governance decorator attached
 *   - covers every ai:* node in `applies-to`
 *   - renders to a non-empty SVG via ELK layout
 *
 * Doubles as the demo asset loaded by https://calmstudio.vercel.app/.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { finalizeArchitecture } from '../tools/finalize.js';
import { isAINode } from '@calmstudio/calm-core';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const FIXTURE_PATH = resolve(
  __dirname,
  '../../../calm-core/test-fixtures/multi-agent-arb-jan-2026.calm.json',
);

let tmpDir: string;
let workingFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'calm-multi-agent-snapshot-'));
  workingFile = join(tmpDir, 'multi-agent-arb-jan-2026.calm.json');
  copyFileSync(FIXTURE_PATH, workingFile);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('multi-agent ARB reference conversion', () => {
  it('fixture file passes JSON parse and has expected layer coverage', () => {
    const arch = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as CalmArchitecture;

    expect(arch.nodes.length).toBeGreaterThanOrEqual(12);
    expect(arch.relationships.length).toBeGreaterThanOrEqual(12);

    // Every of the 8 ARB layer concepts is represented by at least one node type
    const types = new Set(arch.nodes.map((n) => n['node-type']));
    expect(types).toContain('actor');               // User Interaction
    expect(types).toContain('webclient');           // User Interaction
    expect(types).toContain('ai:api-gateway');      // Agent Gateway
    expect(types).toContain('ai:guardrail');        // Agent Gateway
    expect(types).toContain('ai:orchestrator');     // Agent Layer (coordination)
    expect(types).toContain('ai:agent');            // Agent Layer (worker)
    expect(types).toContain('ai:vector-store');     // Knowledge
    expect(types).toContain('ai:knowledge-base');   // Knowledge
    expect(types).toContain('ai:llm');              // LLM
    expect(types).toContain('ai:embedding-model');  // LLM (companion)
    expect(types).toContain('ai:mcp-server');       // MCP
    expect(types).toContain('ai:tool');             // MCP (callable)
    expect(types).toContain('ai:eval-monitor');     // Evaluation
    expect(types).toContain('ai:observability');    // Observability
  });

  it('finalize_architecture validates the reference fixture with zero errors', async () => {
    const result = await finalizeArchitecture({ file: workingFile, render: false });
    expect(result.isError).toBe(false);
    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.validation.errors).toBe(0);
  });

  it('attaches an AIGF decorator covering every AI node', async () => {
    await finalizeArchitecture({ file: workingFile, render: false });
    const finalised = JSON.parse(readFileSync(workingFile, 'utf-8')) as CalmArchitecture;

    const aiNodeIds = finalised.nodes
      .filter((n) => isAINode(n['node-type']))
      .map((n) => n['unique-id'])
      .sort();

    expect(finalised.decorators).toBeDefined();
    expect(finalised.decorators).toHaveLength(1);

    const decorator = finalised.decorators![0]!;
    expect(decorator['unique-id']).toBe('aigf-governance-overlay');
    expect((decorator['applies-to'] as string[]).slice().sort()).toEqual(aiNodeIds);
  });

  it('renders a non-empty SVG via finalize when render=true', async () => {
    const result = await finalizeArchitecture({ file: workingFile, render: true });
    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.rendered).toBeDefined();
    expect(typeof summary.rendered).toBe('string');
    expect(summary.rendered.startsWith('<svg')).toBe(true);
    // Quick sanity on size — should be substantial for 15 nodes
    expect(summary.rendered.length).toBeGreaterThan(1000);
  });

  it('the new ai:mcp-server and ai:observability node types appear in the AIGF applies-to list', async () => {
    await finalizeArchitecture({ file: workingFile, render: false });
    const finalised = JSON.parse(readFileSync(workingFile, 'utf-8')) as CalmArchitecture;
    const appliesTo = finalised.decorators![0]!['applies-to'] as string[];

    const mcpServerId = finalised.nodes.find((n) => n['node-type'] === 'ai:mcp-server')!['unique-id'];
    const observabilityId = finalised.nodes.find((n) => n['node-type'] === 'ai:observability')!['unique-id'];

    expect(appliesTo).toContain(mcpServerId);
    expect(appliesTo).toContain(observabilityId);
  });
});
