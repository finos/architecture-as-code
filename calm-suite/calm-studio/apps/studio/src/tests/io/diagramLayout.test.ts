// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { readLayout, writeLayout, type DiagramLayout } from '$lib/io/diagramLayout';
import { writeDocumentName } from '$lib/io/documentName';
import { finalizeCalmForWrite } from '$lib/io/export';
import { calmToFlow } from '$lib/stores/projection';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const layout: DiagramLayout = {
	'web-app': { x: 120, y: 80 },
	'api-gateway': { x: 120, y: 260 },
};

describe('diagramLayout — persist node positions in CALM metadata', () => {
	it('round-trips positions through metadata', () => {
		const meta = writeLayout(undefined, layout);
		expect(readLayout({ metadata: meta as never })).toEqual(layout);
	});

	it('coexists with the document name in the same metadata object', () => {
		let meta: unknown = writeDocumentName(undefined, 'Payments Platform');
		meta = writeLayout(meta, layout);
		expect(readLayout({ metadata: meta as never })).toEqual(layout);
		expect((meta as Record<string, unknown>).name).toBe('Payments Platform');
	});

	it('ignores malformed/partial position entries', () => {
		const meta = { 'calmstudio-layout': { good: { x: 1, y: 2 }, bad: { x: 1 }, junk: 5 } };
		expect(readLayout({ metadata: meta as never })).toEqual({ good: { x: 1, y: 2 } });
	});

	it('an empty layout removes the key (no noise when nothing is placed)', () => {
		const meta = writeLayout({ name: 'X' }, {});
		expect(meta).toEqual({ name: 'X' });
		expect(readLayout({ metadata: {} as never })).toEqual({});
	});

	it('finalizeCalmForWrite persists layout (and name) and they survive a re-parse', () => {
		const json = JSON.stringify({ nodes: [], relationships: [] });
		const out = JSON.parse(finalizeCalmForWrite(json, 'Trade Surveillance', layout));
		expect(out.metadata.name).toBe('Trade Surveillance');
		expect(readLayout(out)).toEqual(layout);
	});

	it('a container child round-trips losslessly (parent-relative position, keyed by unique-id)', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{ 'unique-id': 'sys', 'node-type': 'system', name: 'Sys', description: '' },
				{ 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: '' },
			],
			relationships: [
				{ 'unique-id': 'r', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc'] } } },
			],
		};
		// The child's position is parent-relative, as Svelte Flow holds it.
		const positionMap = new Map<string, { x: number; y: number; width?: number; height?: number }>([
			['sys', { x: 0, y: 0, width: 300, height: 200 }],
			['svc', { x: 40, y: 60 }],
		]);
		const { nodes } = calmToFlow(arch, positionMap);
		const child = nodes.find((n) => n.id === 'svc')!;
		expect(child.parentId).toBe('sys'); // genuinely nested
		expect(child.position).toEqual({ x: 40, y: 60 }); // positionMap applied as the (relative) position

		// Mimic layoutFromCanvas → writeLayout → readLayout and assert the child survives.
		const captured: DiagramLayout = Object.fromEntries(
			nodes.map((n) => [String(n.data?.calmId ?? n.id), { x: n.position.x, y: n.position.y }]),
		);
		const restored = readLayout({ metadata: writeLayout(undefined, captured) as never });
		expect(restored['svc']).toEqual({ x: 40, y: 60 }); // keyed by unique-id, relative coords intact
		expect(restored['sys']).toEqual({ x: 0, y: 0 });
	});
});
