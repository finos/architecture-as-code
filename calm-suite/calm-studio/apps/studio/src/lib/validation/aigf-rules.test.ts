// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { runAIGFRules } from './aigf-rules';
import type { CalmArchitecture, CalmNode, CalmRelationship, CalmControls } from '@calmstudio/calm-core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeArch(
  nodes: CalmNode[],
  relationships: CalmRelationship[] = []
): CalmArchitecture {
  return { nodes, relationships };
}

function makeAINode(
  type: string,
  controls?: CalmControls,
  id?: string
): CalmNode {
  return {
    'unique-id': id ?? `node-${type.replace(':', '-')}`,
    'node-type': type,
    name: `Test ${type}`,
    controls,
  };
}

function makeRelationship(
  id: string,
  source: string,
  dest: string,
  description?: string
): CalmRelationship {
  return {
    'unique-id': id,
    'relationship-type': 'connects',
    source,
    destination: dest,
    description,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runAIGFRules — empty/non-AI arch', () => {
  it('returns empty array for architecture with no AI nodes', () => {
    const arch = makeArch([
      { 'unique-id': 'svc-1', 'node-type': 'service', name: 'My Service' },
      { 'unique-id': 'db-1', 'node-type': 'database', name: 'My DB' },
    ]);
    const issues = runAIGFRules(arch);
    // aigf-010 always fires (governance score), others should be absent
    const nonInfoIssues = issues.filter(i => i.severity !== 'info');
    expect(nonInfoIssues).toHaveLength(0);
  });
});

describe('aigf-001: AI node missing AIGF controls', () => {
  it('warns when AI node has no AIGF governance controls', () => {
    const arch = makeArch([makeAINode('ai:llm')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-001'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
    expect(rule[0].nodeId).toBe('node-ai-llm');
  });

  it('does NOT warn when AI node has a known AIGF control', () => {
    const controls: CalmControls = {
      'model-version-pinning': { description: 'Pin LLM version', requirements: [] },
    };
    const arch = makeArch([makeAINode('ai:llm', controls)]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-001'));
    expect(rule).toHaveLength(0);
  });

  it('does NOT warn for non-AI node with no controls', () => {
    const arch = makeArch([
      { 'unique-id': 'svc-1', 'node-type': 'service', name: 'My Service' },
    ]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-001'));
    expect(rule).toHaveLength(0);
  });
});

describe('aigf-002: ai:llm missing version pinning', () => {
  it('warns when ai:llm node lacks model-version-pinning control', () => {
    const arch = makeArch([makeAINode('ai:llm')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-002'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
  });

  it('does NOT warn when ai:llm has model-version-pinning', () => {
    const controls: CalmControls = {
      'model-version-pinning': { description: 'Pinned to gpt-4-0613', requirements: [] },
    };
    const arch = makeArch([makeAINode('ai:llm', controls)]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-002'));
    expect(rule).toHaveLength(0);
  });
});

describe('aigf-003: ai:vector-store missing data governance', () => {
  it('warns when ai:vector-store lacks data-governance', () => {
    const arch = makeArch([makeAINode('ai:vector-store')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-003'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
  });
});

describe('aigf-004: ai:agent missing least privilege', () => {
  it('returns error when ai:agent lacks agent-least-privilege', () => {
    const arch = makeArch([makeAINode('ai:agent')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-004'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('error');
  });
});

describe('aigf-005: MCP connection without mcp-security', () => {
  it('returns error when relationship with MCP in description but source node missing mcp-security', () => {
    const llm = makeAINode('ai:llm', undefined, 'llm-1');
    const svc = { 'unique-id': 'svc-1', 'node-type': 'service', name: 'MCP Server' };
    const rel = makeRelationship('rel-1', 'llm-1', 'svc-1', 'MCP protocol connection');
    const arch = makeArch([llm, svc], [rel]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-005'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('error');
  });
});

describe('aigf-006: multi-agent without isolation', () => {
  it('warns when >1 ai:agent and none has agent-isolation', () => {
    const arch = makeArch([
      makeAINode('ai:agent', undefined, 'agent-1'),
      makeAINode('ai:agent', undefined, 'agent-2'),
    ]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-006'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
  });
});

describe('aigf-007: ai:rag-pipeline missing citation traceability', () => {
  it('returns info when ai:rag-pipeline lacks citations-traceability', () => {
    const arch = makeArch([makeAINode('ai:rag-pipeline')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-007'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('info');
  });
});

describe('aigf-008: ai:vector-store missing encryption at rest', () => {
  it('warns when ai:vector-store lacks data-encryption', () => {
    const arch = makeArch([makeAINode('ai:vector-store')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-008'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
  });
});

describe('aigf-009: ai:agent connected to ai:tool without tool chain validation', () => {
  it('warns when ai:agent connects to ai:tool without tool-chain-validation', () => {
    const agent = makeAINode('ai:agent', undefined, 'agent-1');
    const tool = makeAINode('ai:tool', undefined, 'tool-1');
    const rel = makeRelationship('rel-1', 'agent-1', 'tool-1');
    const arch = makeArch([agent, tool], [rel]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-009'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('warning');
  });
});

describe('aigf-010: governance score report', () => {
  it('always returns an info with governance score', () => {
    const arch = makeArch([makeAINode('ai:llm')]);
    const issues = runAIGFRules(arch);
    const rule = issues.filter(i => i.message.includes('aigf-010'));
    expect(rule.length).toBeGreaterThan(0);
    expect(rule[0].severity).toBe('info');
  });
});
