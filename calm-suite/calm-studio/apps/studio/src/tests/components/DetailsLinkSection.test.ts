// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DetailsLinkSection from '$lib/properties/DetailsLinkSection.svelte';
import { applyFromJson, getModel, resetModel } from '$lib/stores/calmModel.svelte';
import { resolveC4Document, clearC4Documents } from '$lib/c4/c4Documents.svelte';
import type { Node } from '@xyflow/svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'multi-agent-system', 'node-type': 'system', name: 'Multi-Agent System', description: 'root' }],
	relationships: [],
	metadata: { 'c4-level': 'context' },
};

const node = {
	id: 'n1',
	data: { calmId: 'multi-agent-system', label: 'Multi-Agent System', calmType: 'system', description: 'root' },
} as unknown as Node;

function renderSection(onmutate = vi.fn()) {
	return { ...render(DetailsLinkSection, { props: { node, onmutate } }), onmutate };
}

beforeEach(() => {
	resetModel();
	clearC4Documents();
});

describe('DetailsLinkSection — create linked document', () => {
	it('creates a child doc, registers it, and wires the node link', async () => {
		applyFromJson(arch);
		const u = renderSection();
		// Section starts collapsed (no link yet) — expand it.
		await fireEvent.click(u.getByRole('button', { name: /define system contents/i }));
		await fireEvent.click(u.getByRole('button', { name: /create new linked document/i }));

		// The node now links to the generated ref...
		const linkedNode = getModel().nodes.find((n) => n['unique-id'] === 'multi-agent-system')!;
		expect((linkedNode.details as { 'detailed-architecture'?: string })['detailed-architecture']).toBe(
			'multi-agent-system.arch.json',
		);
		// ...and that ref resolves to a registered doc whose root reuses the id (identity continuity),
		// one C4 level below the parent (context → container).
		const reg = resolveC4Document('multi-agent-system.arch.json');
		expect(reg).toBeTruthy();
		expect(reg!.doc.nodes?.some((n) => n['unique-id'] === 'multi-agent-system')).toBe(true);
		expect(reg!.level).toBe('container');
		expect(u.onmutate).toHaveBeenCalled();
	});

	it('hides the create button once the node is linked', async () => {
		applyFromJson(arch);
		const u = renderSection();
		await fireEvent.click(u.getByRole('button', { name: /define system contents/i }));
		await fireEvent.click(u.getByRole('button', { name: /create new linked document/i }));
		expect(u.queryByRole('button', { name: /create new linked document/i })).toBeNull();
	});
});
