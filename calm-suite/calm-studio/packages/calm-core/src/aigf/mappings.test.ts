// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { getAIGFForNodeType, isAINode } from './mappings.js';

describe('AIGF Mappings', () => {
  it("getAIGFForNodeType('ai:llm') returns non-empty risks and mitigations", () => {
    const result = getAIGFForNodeType('ai:llm');
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.mitigations.length).toBeGreaterThan(0);
  });

  it("getAIGFForNodeType('ai:agent') returns agent-specific risks (AIR-SEC-024, AIR-OP-018)", () => {
    const result = getAIGFForNodeType('ai:agent');
    const riskIds = result.risks.map((r) => r.id);
    expect(riskIds).toContain('AIR-SEC-024');
    expect(riskIds).toContain('AIR-OP-018');
  });

  it("getAIGFForNodeType('ai:guardrail') returns empty risks (guardrails ARE the mitigation)", () => {
    const result = getAIGFForNodeType('ai:guardrail');
    expect(result.risks).toHaveLength(0);
  });

  it("getAIGFForNodeType('ai:human-in-the-loop') returns empty risks", () => {
    const result = getAIGFForNodeType('ai:human-in-the-loop');
    expect(result.risks).toHaveLength(0);
  });

  it("getAIGFForNodeType('ai:eval-monitor') returns empty risks", () => {
    const result = getAIGFForNodeType('ai:eval-monitor');
    expect(result.risks).toHaveLength(0);
  });

  it("getAIGFForNodeType('service') returns empty (non-AI node)", () => {
    const result = getAIGFForNodeType('service');
    expect(result.risks).toHaveLength(0);
    expect(result.mitigations).toHaveLength(0);
  });

  it('isAINode returns true for ai:llm', () => {
    expect(isAINode('ai:llm')).toBe(true);
  });

  it('isAINode returns false for service', () => {
    expect(isAINode('service')).toBe(false);
  });

  it('isAINode returns false for fluxnova:engine', () => {
    expect(isAINode('fluxnova:engine')).toBe(false);
  });

  it('isAINode accepts node object with node-type property', () => {
    expect(isAINode({ 'node-type': 'ai:llm' })).toBe(true);
    expect(isAINode({ 'node-type': 'service' })).toBe(false);
  });
});
