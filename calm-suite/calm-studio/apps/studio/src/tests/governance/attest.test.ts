// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
	applyFromJson,
	getModel,
	attestControlOnNode,
	unattestControlOnNode,
	isControlAttestedOnNode,
	attestArchControl,
	resetModel,
} from '$lib/stores/calmModel.svelte';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
	nodes: [{ 'unique-id': 'vector-dbs', 'node-type': 'ai:vector-store', name: 'Vector DBs', description: 'x' }],
	relationships: [],
};

const attestation = {
	controlId: 'CCC.MARefArc.CN04',
	guidelineId: 'AIR-PREV-002',
	requirementUrl: 'https://hub.grc.store/v1/catalogs/finos-ccc/ccc.marefarc.cn/versions/v2026.06-rc1',
	name: 'Vector store tenant isolation',
};

beforeEach(() => resetModel());

describe('attestation → CALM controls', () => {
	it('writes a CALM controls entry grouped under the guideline', () => {
		applyFromJson(arch);
		attestControlOnNode('vector-dbs', attestation);

		const node = getModel().nodes.find((n) => n['unique-id'] === 'vector-dbs') as { controls?: Record<string, { requirements: { 'requirement-url': string; config: Record<string, unknown> }[] }> };
		// CALM 1.2: domain-oriented key, framework ids in config (not in the key).
		const entry = node.controls!['ai-governance'];
		expect(entry).toBeDefined();
		expect(node.controls).not.toHaveProperty('air-prev-002');
		expect(entry!.requirements[0]!.config).toMatchObject({
			'control-id': 'CCC.MARefArc.CN04',
			attested: true,
			'attested-for': 'AIR-PREV-002',
		});
		expect(isControlAttestedOnNode('vector-dbs', 'CCC.MARefArc.CN04')).toBe(true);
	});

	it('is idempotent by control-id', () => {
		applyFromJson(arch);
		attestControlOnNode('vector-dbs', attestation);
		attestControlOnNode('vector-dbs', attestation);
		const node = getModel().nodes.find((n) => n['unique-id'] === 'vector-dbs') as { controls?: Record<string, { requirements: unknown[] }> };
		expect(node.controls!['ai-governance']!.requirements).toHaveLength(1);
	});

	it('un-attest removes the control entry', () => {
		applyFromJson(arch);
		attestControlOnNode('vector-dbs', attestation);
		unattestControlOnNode('vector-dbs', 'CCC.MARefArc.CN04');
		expect(isControlAttestedOnNode('vector-dbs', 'CCC.MARefArc.CN04')).toBe(false);
	});

	it('attests at architecture (document) scope', () => {
		applyFromJson(arch);
		attestArchControl(attestation);
		const controls = (getModel() as { controls?: Record<string, unknown> }).controls;
		expect(controls!['ai-governance']).toBeDefined();
	});
});
