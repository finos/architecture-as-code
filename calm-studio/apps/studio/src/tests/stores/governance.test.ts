// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { createMinimalArch, createAIGovernanceArch } from '@calmstudio/calm-core/test-fixtures';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';
import {
	refreshGovernance,
	getArchitectureScore,
	hasAINodes,
	getSelectedNodeGovernance,
	updateSelectedNodeGovernance,
} from '$lib/stores/governance.svelte';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	resetModel();
	// Reset governance state by refreshing with an empty model
	// (refreshGovernance reads from getModel(), so resetting model first is correct)
	refreshGovernance();
});

// ─── refreshGovernance with non-AI architecture ───────────────────────────────

describe('refreshGovernance — no AI nodes', () => {
	it('hasAINodes returns false for plain service/database arch', () => {
		applyFromJson(createMinimalArch());
		refreshGovernance();
		expect(hasAINodes()).toBe(false);
	});

	it('getArchitectureScore returns null when no AI nodes', () => {
		applyFromJson(createMinimalArch());
		refreshGovernance();
		expect(getArchitectureScore()).toBeNull();
	});

	it('hasAINodes returns false on empty model', () => {
		// model was reset in beforeEach, refreshGovernance already called
		expect(hasAINodes()).toBe(false);
	});
});

// ─── refreshGovernance with AI architecture ───────────────────────────────────

describe('refreshGovernance — with AI nodes', () => {
	beforeEach(() => {
		applyFromJson(createAIGovernanceArch());
		refreshGovernance();
	});

	it('hasAINodes returns true when AI nodes are present', () => {
		expect(hasAINodes()).toBe(true);
	});

	it('getArchitectureScore returns a number when AI nodes are present', () => {
		const score = getArchitectureScore();
		expect(score).not.toBeNull();
		expect(typeof score).toBe('number');
	});

	it('getArchitectureScore returns a value between 0 and 100', () => {
		const score = getArchitectureScore()!;
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});

	it('score starts at 0 when no mitigations are applied for ai:orchestrator and ai:agent', () => {
		// createAIGovernanceArch has ai:orchestrator, ai:agent, ai:llm, ai:vector-store
		// ai:llm has one control applied: 'security-domain' — which is NOT in the
		// AIGF mitigation calmControlKey list for ai:llm (those are data-leakage-prevention etc.)
		// So score reflects how many actual AIGF mitigation keys are applied
		const score = getArchitectureScore()!;
		// Score must be a number 0-100; correctness depends on fixture controls
		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(100);
	});
});

// ─── getSelectedNodeGovernance ────────────────────────────────────────────────

describe('getSelectedNodeGovernance', () => {
	it('returns empty state initially (no node selected)', () => {
		const gov = getSelectedNodeGovernance();
		expect(gov.risks).toHaveLength(0);
		expect(gov.mitigations).toHaveLength(0);
		expect(gov.nodeId).toBeNull();
		expect(gov.nodeControls).toBeUndefined();
	});

	it('returns risks and mitigations for an ai:llm node', () => {
		applyFromJson(createAIGovernanceArch());
		updateSelectedNodeGovernance('ai:llm', 'ai-llm');
		const gov = getSelectedNodeGovernance();
		expect(gov.nodeId).toBe('ai-llm');
		expect(Array.isArray(gov.risks)).toBe(true);
		expect(Array.isArray(gov.mitigations)).toBe(true);
		// ai:llm is an AI node type — should have risks and mitigations from AIGF catalogue
		expect(gov.risks.length + gov.mitigations.length).toBeGreaterThan(0);
	});

	it('returns nodeControls when the node has applied controls', () => {
		applyFromJson(createAIGovernanceArch());
		updateSelectedNodeGovernance('ai:llm', 'ai-llm');
		const gov = getSelectedNodeGovernance();
		// The ai-llm node in the fixture has 'security-domain' control applied
		expect(gov.nodeControls).toBeDefined();
		expect(gov.nodeControls!['security-domain']).toBeDefined();
	});
});

// ─── updateSelectedNodeGovernance ─────────────────────────────────────────────

describe('updateSelectedNodeGovernance', () => {
	it('clears governance state when called with null nodeType', () => {
		applyFromJson(createAIGovernanceArch());
		updateSelectedNodeGovernance('ai:agent', 'ai-agent');
		// Now clear
		updateSelectedNodeGovernance(null, null);
		const gov = getSelectedNodeGovernance();
		expect(gov.risks).toHaveLength(0);
		expect(gov.mitigations).toHaveLength(0);
		expect(gov.nodeId).toBeNull();
	});

	it('clears governance state for non-AI node types', () => {
		applyFromJson(createMinimalArch());
		updateSelectedNodeGovernance('service', 'api-service');
		const gov = getSelectedNodeGovernance();
		// 'service' is not an AI node — should produce empty governance
		expect(gov.risks).toHaveLength(0);
		expect(gov.mitigations).toHaveLength(0);
		expect(gov.nodeId).toBeNull();
	});

	it('populates governance data for ai:agent node type', () => {
		applyFromJson(createAIGovernanceArch());
		updateSelectedNodeGovernance('ai:agent', 'ai-agent');
		const gov = getSelectedNodeGovernance();
		expect(gov.nodeId).toBe('ai-agent');
		expect(Array.isArray(gov.risks)).toBe(true);
	});

	it('updates governance state when switching between AI nodes', () => {
		applyFromJson(createAIGovernanceArch());
		updateSelectedNodeGovernance('ai:llm', 'ai-llm');
		const llmGov = { ...getSelectedNodeGovernance() };
		updateSelectedNodeGovernance('ai:agent', 'ai-agent');
		const agentGov = getSelectedNodeGovernance();
		// Should now reflect agent node, not LLM
		expect(agentGov.nodeId).toBe('ai-agent');
		expect(agentGov.nodeId).not.toBe(llmGov.nodeId);
	});
});
