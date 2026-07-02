// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration test: load the canonical loan-approval fixture and exercise the
 * viz pipeline end-to-end — calmToFlow → decorateFromArch → severity resolution
 * → threat extraction. Asserts the spike's core invariants on a realistic
 * 79-node / 70-rel / 58-threat architecture.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { calmToFlow } from '$lib/stores/projection';
import { decorateFromArch, collectThreatBadges } from '$lib/viz/integration/decorateFlowNodes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
	__dirname,
	'../../static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json'
);
const arch = JSON.parse(readFileSync(fixturePath, 'utf8')) as CalmArchitecture;

describe('viz integration — canonical loan-approval fixture', () => {
	it('canonical doc shape: 79 nodes, 70 relationships', () => {
		expect(arch.nodes?.length).toBe(79);
		expect(arch.relationships?.length).toBe(70);
	});

	it('canonical doc has 58 threat decorators distributed across nodes', () => {
		const total = (arch.nodes ?? []).reduce((sum, n) => {
			const decs = (n as unknown as { decorators?: Array<{ type?: string }> }).decorators ?? [];
			return sum + decs.filter((d) => d?.type === 'threat').length;
		}, 0);
		expect(total).toBe(58);
	});

	it('calmToFlow + decorateFromArch produces nodes with badges in default mode', () => {
		const { nodes } = calmToFlow(arch);
		const decorated = decorateFromArch(nodes, arch, { overlayMode: 'default' });
		expect(decorated.length).toBe(79);
		const nodesWithBadges = decorated.filter((n) => {
			const b = (n.data as { badges?: unknown[] } | undefined)?.badges;
			return Array.isArray(b) && b.length > 0;
		});
		// Most nodes either have threats, controls, or both — at minimum 13 root-level controlled nodes show badges.
		expect(nodesWithBadges.length).toBeGreaterThan(13);
	});

	it('overlayMode=threat injects severity into node data; default strips it', () => {
		const { nodes } = calmToFlow(arch);
		const inThreat = decorateFromArch(nodes, arch, { overlayMode: 'threat' });
		const inDefault = decorateFromArch(nodes, arch, { overlayMode: 'default' });

		const threatNonUnknown = inThreat.filter(
			(n) => ((n.data as { severity?: string } | undefined)?.severity ?? 'unknown') !== 'unknown'
		);
		const defaultNonUnknown = inDefault.filter(
			(n) => ((n.data as { severity?: string } | undefined)?.severity ?? 'unknown') !== 'unknown'
		);

		expect(threatNonUnknown.length).toBeGreaterThan(0); // some nodes have threats
		expect(defaultNonUnknown.length).toBe(0); // default mode strips severity
	});

	it('cross-layer (T-XL-*) decorators emit critical severity on host nodes', () => {
		const { nodes } = calmToFlow(arch);
		const decorated = decorateFromArch(nodes, arch, { overlayMode: 'threat' });
		const critical = decorated.filter(
			(n) => (n.data as { severity?: string } | undefined)?.severity === 'critical'
		);
		// The migration assigns 'critical' to all T-XL-* threats — at least 1 node should be critical.
		expect(critical.length).toBeGreaterThan(0);
	});

	it('collectThreatBadges returns 58 threat decorator badges total', () => {
		const threats = collectThreatBadges(arch);
		expect(threats.length).toBe(58);
		expect(threats.every((t) => t.data?.decoratorType === 'threat')).toBe(true);
	});

	it('composed-of edges are suppressed when parent-child nesting captures the relation', () => {
		const { edges } = calmToFlow(arch);
		const composedEdges = edges.filter((e) => e.type === 'composed-of');
		// Loan-approval has 13 composed-of relationships, all hierarchical (target nested under source).
		// All 13 should be suppressed → 0 composed-of edges in the projection.
		expect(composedEdges.length).toBe(0);
	});

	it('connects edges remain visible after suppression pass', () => {
		const { edges } = calmToFlow(arch);
		const connects = edges.filter((e) => e.type === 'connects');
		expect(connects.length).toBeGreaterThan(0);
	});
});
