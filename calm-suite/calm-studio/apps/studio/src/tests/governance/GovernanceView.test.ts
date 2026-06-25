// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GovernanceView from '$lib/governance/GovernanceView.svelte';
import {
	applyFromJson,
	upsertDecorator,
	isControlAttestedOnNode,
	resetModel,
} from '$lib/stores/calmModel.svelte';
import { clearCatalogCache } from '$lib/stores/gemaraCatalogs';
import { buildGemaraDecorator, type CalmArchitecture } from '@calmstudio/calm-core';

// A CCC control catalog body whose CN04 satisfies AIGF guideline AIR-PREV-002.
const controlBody = {
	metadata: { id: 'ccc.marefarc.cn', version: 'v1' },
	controls: [
		{
			id: 'CCC.MARefArc.CN04',
			title: 'Vector store tenant isolation',
			guidelines: [{ 'reference-id': 'finos-air', entries: [{ 'reference-id': 'AIR-PREV-002' }] }],
			'assessment-requirements': [{ id: 'CCC.MARefArc.CN04.AR01', text: 'MUST isolate embeddings per tenant.' }],
		},
	],
};

const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'vector-dbs', 'node-type': 'ai:vector-store', name: 'Vector DBs', description: 'x' }],
	relationships: [],
};

beforeEach(() => {
	resetModel();
	clearCatalogCache();
});
afterEach(() => vi.unstubAllGlobals());

describe('GovernanceView (connected AIGF↔CCC)', () => {
	it('joins AIGF guidance to CCC controls and attests on the node', async () => {
		applyFromJson(arch);
		// Incorporate AIGF guidance + CCC controls at architecture scope.
		upsertDecorator(
			buildGemaraDecorator({ artifact: 'guidance', kind: 'catalog', catalogRef: { namespace: 'finos-aigf', catalogId: 'finos-air', version: '0.2.0' }, appliesTo: ['@architecture'] }),
		);
		upsertDecorator(
			buildGemaraDecorator({ artifact: 'requirements', kind: 'catalog', catalogRef: { namespace: 'finos-ccc', catalogId: 'ccc.marefarc.cn', version: 'v1' }, appliesTo: ['@architecture'] }),
		);
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(controlBody), { status: 200 })));

		const utils = render(GovernanceView, {
			props: { elementId: 'vector-dbs', nodeType: 'ai:vector-store', onmutate: vi.fn() },
		});

		// Guidance catalogs fold up — expand the AIGF group first.
		await fireEvent.click(await utils.findByText('FINOS AI Governance Framework'));
		// AIR-PREV-002 is recommended for ai:vector-store; expand it.
		const head = await utils.findByText('Data Filtering From External Knowledge Bases');
		await fireEvent.click(head);

		// The CCC control that satisfies it is surfaced, with its assessment-requirement.
		expect(utils.getByText('CCC.MARefArc.CN04')).toBeTruthy();
		expect(utils.getByText(/MUST isolate embeddings/)).toBeTruthy();

		// Attest → the control's checkbox writes a CALM controls entry on the node.
		await fireEvent.click(utils.getByRole('checkbox', { name: /mark control CCC\.MARefArc\.CN04 implemented/i }));
		expect(isControlAttestedOnNode('vector-dbs', 'CCC.MARefArc.CN04')).toBe(true);
	});

	it('one-click Apply governance incorporates AIGF + CCC', async () => {
		applyFromJson(arch);
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(controlBody), { status: 200 })));
		const utils = render(GovernanceView, { props: { elementId: 'vector-dbs', nodeType: 'ai:vector-store' } });
		await fireEvent.click(await utils.findByRole('button', { name: /apply governance/i }));
		// guidance is now incorporated → its catalog group appears; expand it.
		await fireEvent.click(await utils.findByText('FINOS AI Governance Framework'));
		expect(await utils.findByText('Data Filtering From External Knowledge Bases')).toBeTruthy();
	});

	it('shows an apply prompt when no guidance is incorporated', async () => {
		applyFromJson(arch);
		const utils = render(GovernanceView, { props: { elementId: 'vector-dbs', nodeType: 'ai:vector-store' } });
		expect(await utils.findByRole('button', { name: /apply governance/i })).toBeTruthy();
	});

	// A platform system containing two leaf nodes — the realistic shape for scoping.
	const platformArch = () => ({
		nodes: [
			{ 'unique-id': 'platform', 'node-type': 'system', name: 'Platform', description: '' },
			{ 'unique-id': 'obj-store', 'node-type': 'ai:vector-store', name: 'Object Store', description: 'x' },
			{ 'unique-id': 'gateway', 'node-type': 'service', name: 'Gateway', description: 'y' },
		],
		relationships: [
			{ 'unique-id': 'plat-contains', 'relationship-type': { 'composed-of': { container: 'platform', nodes: ['obj-store', 'gateway'] } } },
		],
	});

	it('a node-scoped control catalog appears only on its node, tagged "this node"', async () => {
		applyFromJson(platformArch());
		// CCC.ObjStor.CN attached to the object-store leaf node only.
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'requirements',
				kind: 'catalog',
				catalogRef: { namespace: 'finos-ccc', catalogId: 'ccc.objstor.cn', version: 'v1' },
				appliesTo: ['obj-store'],
			}),
		);

		const onNode = render(GovernanceView, { props: { elementId: 'obj-store', nodeType: 'ai:vector-store', onmutate: vi.fn() } });
		expect(await onNode.findByText('ccc.objstor.cn')).toBeTruthy();
		expect(onNode.getByText('this node')).toBeTruthy(); // scope tag
		onNode.unmount();

		// A sibling node does NOT inherit the node-scoped catalog.
		const other = render(GovernanceView, { props: { elementId: 'gateway', nodeType: 'service', onmutate: vi.fn() } });
		await new Promise((r) => setTimeout(r, 0));
		expect(other.queryByText('ccc.objstor.cn')).toBeNull();
	});

	it('Apply governance on the system node attaches AIGF guidance, not just CCC', async () => {
		applyFromJson({
			nodes: [
				{ 'unique-id': 'mas', 'node-type': 'system', name: 'Multi-Agent System', description: '' },
				{ 'unique-id': 'agent-layer', 'node-type': 'system', name: 'Agent Layer', description: '' },
			],
			relationships: [
				{ 'unique-id': 'r', 'relationship-type': { 'composed-of': { container: 'mas', nodes: ['agent-layer'] } } },
			],
		});
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(controlBody), { status: 200 })));
		// The nothing-selected view governs the top-level system node.
		const utils = render(GovernanceView, { props: { elementId: 'mas', nodeType: 'system', onmutate: vi.fn() } });
		await fireEvent.click(await utils.findByRole('button', { name: /apply governance/i }));
		// AIGF guidance must now appear (the bug: only CCC attached, "No guidance" stuck).
		expect(await utils.findByText('FINOS AI Governance Framework')).toBeTruthy();
	});

	it('a catalog on the containing system is inherited by its nodes, tagged "system"', async () => {
		applyFromJson(platformArch());
		// A control catalog attached to the top-level system.
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'requirements',
				kind: 'catalog',
				catalogRef: { namespace: 'finos-ccc', catalogId: 'ccc.platform.cn', version: 'v1' },
				appliesTo: ['platform'],
			}),
		);
		// A leaf node inherits it (and the tag reads "system", not "this node").
		const leaf = render(GovernanceView, { props: { elementId: 'gateway', nodeType: 'service', onmutate: vi.fn() } });
		expect(await leaf.findByText('ccc.platform.cn')).toBeTruthy();
		expect(leaf.getByText('system')).toBeTruthy();
	});

	it('removing a catalog from a leaf panel does NOT delete it from the wider system', async () => {
		applyFromJson(platformArch());
		// Same catalog bound at BOTH the system and the leaf.
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'requirements',
				kind: 'catalog',
				catalogRef: { namespace: 'finos-ccc', catalogId: 'ccc.shared.cn', version: 'v1' },
				appliesTo: ['platform', 'obj-store'],
			}),
		);
		const onNode = render(GovernanceView, { props: { elementId: 'obj-store', nodeType: 'ai:vector-store', onmutate: vi.fn() } });
		await fireEvent.click(await onNode.findByRole('button', { name: /remove control catalog ccc\.shared\.cn/i }));
		onNode.unmount();

		// The system binding survives → a sibling still inherits it.
		const sib = render(GovernanceView, { props: { elementId: 'gateway', nodeType: 'service', onmutate: vi.fn() } });
		expect(await sib.findByText('ccc.shared.cn')).toBeTruthy();
	});

	it('removing an inherited (system-scoped) catalog from a leaf asks first', async () => {
		applyFromJson(platformArch());
		upsertDecorator(
			buildGemaraDecorator({
				artifact: 'requirements',
				kind: 'catalog',
				catalogRef: { namespace: 'finos-ccc', catalogId: 'ccc.platform.cn', version: 'v1' },
				appliesTo: ['platform'],
			}),
		);
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false); // user cancels
		const leaf = render(GovernanceView, { props: { elementId: 'gateway', nodeType: 'service', onmutate: vi.fn() } });
		await fireEvent.click(await leaf.findByRole('button', { name: /remove control catalog ccc\.platform\.cn/i }));
		expect(confirmSpy).toHaveBeenCalled();
		leaf.unmount();

		// Cancelled → still inherited by another node.
		const sib = render(GovernanceView, { props: { elementId: 'obj-store', nodeType: 'ai:vector-store', onmutate: vi.fn() } });
		expect(await sib.findByText('ccc.platform.cn')).toBeTruthy();
		confirmSpy.mockRestore();
	});
});
