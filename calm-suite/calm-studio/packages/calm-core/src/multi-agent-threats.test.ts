// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration test for the FINOS Multi-Agent Reference Architecture threat
 * model artefact (#2551).
 *
 * Loads the canonical arch + threats sidecar from `test-fixtures/multi-agent-threats/`,
 * merges decorators, and exercises every reverse-lookup helper:
 *
 *   - 10 decorators (1 control-catalog + 8 layer + 1 cross-layer)
 *   - 43 threats across all layers
 *   - 36 controls in catalog
 *   - per-node threats reachable via decorator.applies-to OR
 *     data.threats[].affected-nodes
 *   - control lookup by id works
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CalmArchitecture, CalmDecorator } from './types.js';
import {
	getDecoratorsByType,
	getDecoratorsForNode,
	getThreatsForNode,
	getControlById,
	type CalmThreatModelDecorator,
	type CalmControlCatalogDecorator
} from './decorators.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const archPath = resolve(here, '../test-fixtures/multi-agent-threats/arch.calm.json');
const threatsPath = resolve(here, '../test-fixtures/multi-agent-threats/arch.threats.calm.json');

function loadArchWithThreats(): CalmArchitecture {
	const arch = JSON.parse(readFileSync(archPath, 'utf-8')) as CalmArchitecture;
	const sidecar = JSON.parse(readFileSync(threatsPath, 'utf-8')) as {
		decorators: CalmDecorator[];
	};
	return { ...arch, decorators: [...(arch.decorators ?? []), ...sidecar.decorators] };
}

describe('FINOS Multi-Agent Threat Model (#2551)', () => {
	it('loads 10 decorators total (8 layer threat-model + 1 cross-layer + 1 control-catalog)', () => {
		const arch = loadArchWithThreats();
		expect(arch.decorators).toBeDefined();
		expect(arch.decorators!.length).toBe(10);
	});

	it('contains 1 control-catalog decorator with 36 controls', () => {
		const arch = loadArchWithThreats();
		const catalogs = getDecoratorsByType(arch, 'control-catalog') as CalmControlCatalogDecorator[];
		expect(catalogs).toHaveLength(1);
		expect(catalogs[0]!.data.controls).toHaveLength(36);
	});

	it('contains 9 threat-model decorators (8 layer + 1 cross-layer)', () => {
		const arch = loadArchWithThreats();
		const tms = getDecoratorsByType(arch, 'threat-model') as CalmThreatModelDecorator[];
		expect(tms).toHaveLength(9);
	});

	it('aggregates the expected total threats across all layer decorators', () => {
		const arch = loadArchWithThreats();
		const tms = getDecoratorsByType(arch, 'threat-model') as CalmThreatModelDecorator[];
		let total = 0;
		for (const tm of tms) total += tm.data.threats.length;
		// Sum of all per-layer counts in the FINOS MA threat model (apr-2026):
		//   UIL=6, AGL=4, AL=21 (sub-sections), KL=4, LLM=5, MCP=6, EVL=3, OBL=5, XL=4
		expect(total).toBe(58);
	});

	it('control C8 is in catalog with ABAC description', () => {
		const arch = loadArchWithThreats();
		const c = getControlById(arch, 'C8');
		expect(c).toBeDefined();
		expect(c!.description).toContain('ABAC');
	});

	it('agent-gateway-guardrails node has at least one threat (T-AGL-03 Guardrail Evasion)', () => {
		const arch = loadArchWithThreats();
		const threats = getThreatsForNode(arch, 'agent-gateway-guardrails');
		expect(threats.length).toBeGreaterThan(0);
		const ids = threats.map((t) => t.id);
		expect(ids).toContain('T-AGL-03');
	});

	it('agent-registry has Agent Registry Poisoning threat (T-AGL-01)', () => {
		const arch = loadArchWithThreats();
		const threats = getThreatsForNode(arch, 'agent-registry');
		const t = threats.find((t) => t.id === 'T-AGL-01');
		expect(t).toBeDefined();
		expect(t!.controls).toContain('C8');
		expect(t!.controls).toContain('C9');
	});

	it('agent-layer is referenced by cross-layer decorator (T-XL-*)', () => {
		const arch = loadArchWithThreats();
		const decorators = getDecoratorsForNode(arch, 'agent-layer');
		const ids = decorators.map((d) => d['unique-id']);
		expect(ids).toContain('tm-cross-layer-fsi');
	});

	it('long-term-memory has T-AL-20 (Long-Term Memory Poisoning) and T-AL-21', () => {
		const arch = loadArchWithThreats();
		const threats = getThreatsForNode(arch, 'long-term-memory');
		const ids = threats.map((t) => t.id);
		expect(ids).toContain('T-AL-20');
		expect(ids).toContain('T-AL-21');
	});

	it('every threat references at least one control id, and every referenced control resolves in catalog', () => {
		const arch = loadArchWithThreats();
		const tms = getDecoratorsByType(arch, 'threat-model') as CalmThreatModelDecorator[];
		const missing: string[] = [];
		for (const tm of tms) {
			for (const t of tm.data.threats) {
				expect(t.controls.length, `Threat ${t.id} has no controls`).toBeGreaterThan(0);
				for (const cid of t.controls) {
					if (!getControlById(arch, cid)) missing.push(`${t.id} -> ${cid}`);
				}
			}
		}
		expect(missing, 'every threat control id must resolve in catalog').toEqual([]);
	});

	it('every applies-to and affected-nodes id resolves to a real architecture node', () => {
		const arch = loadArchWithThreats();
		const nodeIds = new Set(arch.nodes.map((n) => n['unique-id']));
		const dangling: string[] = [];
		for (const d of arch.decorators ?? []) {
			for (const id of d['applies-to']) {
				if (!nodeIds.has(id)) dangling.push(`${d['unique-id']}.applies-to -> ${id}`);
			}
			const data = d.data as { threats?: Array<{ id: string; 'affected-nodes'?: string[] }> };
			if (Array.isArray(data.threats)) {
				for (const t of data.threats) {
					for (const id of t['affected-nodes'] ?? []) {
						if (!nodeIds.has(id)) {
							dangling.push(`${d['unique-id']}.${t.id}.affected-nodes -> ${id}`);
						}
					}
				}
			}
		}
		expect(dangling, 'no dangling node references').toEqual([]);
	});
});
