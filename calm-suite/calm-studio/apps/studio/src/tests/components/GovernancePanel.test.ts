// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import GovernancePanel from '$lib/governance/GovernancePanel.svelte';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';
import {
	refreshGovernance,
	updateSelectedNodeGovernance,
	hasAINodes,
	getArchitectureScore,
} from '$lib/stores/governance.svelte';
import { createAIGovernanceArch } from '@calmstudio/calm-core/test-fixtures';

beforeEach(() => {
	resetModel();
	// Reset governance state by clearing node selection
	updateSelectedNodeGovernance(null, null);
});

describe('GovernancePanel — no selection / empty state', () => {
	it('renders AIGF Governance panel header', () => {
		const { getByText } = render(GovernancePanel);
		expect(getByText(/AIGF Governance/i)).toBeTruthy();
	});

	it('shows empty state message when no node is selected', () => {
		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: null },
		});
		expect(getByText(/select an AI node/i)).toBeTruthy();
	});

	it('shows "No governance recommendations" message for non-AI node type', () => {
		resetModel();
		applyFromJson({
			nodes: [{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'Regular Service' }],
			relationships: [],
		});
		refreshGovernance();
		updateSelectedNodeGovernance('service', 'svc-1');

		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: 'svc-1', selectedNodeType: 'service' },
		});
		expect(getByText(/no governance recommendations for this node type/i)).toBeTruthy();
	});
});

describe('GovernancePanel — with AI nodes in architecture', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(createAIGovernanceArch());
		refreshGovernance();
	});

	it('hasAINodes returns true after loading AI governance arch', () => {
		expect(hasAINodes()).toBe(true);
	});

	it('getArchitectureScore returns a number when AI nodes present', () => {
		expect(getArchitectureScore()).not.toBeNull();
	});

	it('renders governance score badge when AI nodes are present and score is non-null', () => {
		const score = getArchitectureScore();
		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: null, selectedNodeType: null },
		});
		// Score badge shows percentage value
		if (score !== null) {
			expect(getByText(`${score}%`)).toBeTruthy();
		} else {
			// If score is null, badge is not shown — no assertion needed
		}
	});
});

describe('GovernancePanel — with AI node selected', () => {
	beforeEach(() => {
		resetModel();
		applyFromJson(createAIGovernanceArch());
		refreshGovernance();
		// Select the ai:llm node which has risks and mitigations
		updateSelectedNodeGovernance('ai:llm', 'ai-llm');
	});

	it('shows applicable risks section for ai:llm node', () => {
		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: 'ai-llm', selectedNodeType: 'ai:llm' },
		});
		expect(getByText(/applicable risks/i)).toBeTruthy();
	});

	it('shows recommended mitigations section for ai:llm node', () => {
		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: 'ai-llm', selectedNodeType: 'ai:llm' },
		});
		expect(getByText(/recommended mitigations/i)).toBeTruthy();
	});

	it('renders Apply buttons that are focusable (a11y)', () => {
		const { getAllByRole } = render(GovernancePanel, {
			props: { selectedNodeId: 'ai-llm', selectedNodeType: 'ai:llm' },
		});
		const applyBtns = getAllByRole('button', { name: /apply/i });
		// At least one Apply button should be present for unmitigated recommendations
		expect(applyBtns.length).toBeGreaterThan(0);
		for (const btn of applyBtns) {
			expect((btn as HTMLButtonElement).disabled).toBe(false);
		}
	});

	it('renders unmitigated banner when mitigations not applied', () => {
		const { getByText } = render(GovernancePanel, {
			props: { selectedNodeId: 'ai-llm', selectedNodeType: 'ai:llm' },
		});
		// Unmitigated banner shows count of open recommendations
		expect(getByText(/unmitigated recommendation/i)).toBeTruthy();
	});
});
