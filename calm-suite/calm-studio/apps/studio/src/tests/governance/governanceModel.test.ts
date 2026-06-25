// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { buildGovernanceView } from '$lib/governance/governanceModel';
import type { GemaraControl, GemaraGuideline } from '@calmstudio/calm-core';

const guidelines: GemaraGuideline[] = [
	{ id: 'AIR-PREV-002', title: 'Data Filtering' },
	{ id: 'AIR-DET-001', title: 'AI Data Leakage Detection' },
	{ id: 'AIR-PREV-014', title: 'Encryption' },
];

const controls: GemaraControl[] = [
	{ id: 'CCC.MARefArc.CN01', title: 'Knowledge Layer filtering', guidelines: [{ catalogId: 'finos-air', entryIds: ['AIR-PREV-002'] }] },
	{ id: 'CCC.MARefArc.CN04', title: 'Vector isolation', guidelines: [{ catalogId: 'finos-air', entryIds: ['AIR-PREV-002', 'AIR-PREV-014'] }] },
];

const aigf = (gl: GemaraGuideline[] = guidelines) => ({ id: 'finos-air', title: 'AIGF', guidelines: gl });

describe('buildGovernanceView', () => {
	it('joins controls to the guidelines they satisfy (canonical link), within a catalog group', () => {
		const v = buildGovernanceView({
			guidanceCatalogs: [aigf()],
			controlCatalogs: [{ id: 'ccc.marefarc.cn', controls }],
		});
		expect(v.guidanceCatalogs).toHaveLength(1);
		const grp = v.guidanceCatalogs[0]!;
		const byId = Object.fromEntries(grp.guidelines.map((g) => [g.guideline.id, g]));
		expect(byId['AIR-PREV-002']!.controls.map((c) => c.control.id)).toEqual(['CCC.MARefArc.CN01', 'CCC.MARefArc.CN04']);
		expect(byId['AIR-PREV-014']!.controls.map((c) => c.control.id)).toEqual(['CCC.MARefArc.CN04']);
		expect(byId['AIR-DET-001']!.controls).toHaveLength(0);
		expect(grp.coverage).toEqual({ withControls: 2, total: 3 });
		expect(v.coverage).toEqual({ withControls: 2, total: 3 });
	});

	it('orders recommended guidelines first within each catalog', () => {
		const v = buildGovernanceView({
			guidanceCatalogs: [aigf()],
			recommendedIds: new Set(['AIR-DET-001']),
			controlCatalogs: [{ id: 'ccc.marefarc.cn', controls }],
		});
		const gl = v.guidanceCatalogs[0]!.guidelines;
		expect(gl[0]!.guideline.id).toBe('AIR-DET-001');
		expect(gl[0]!.recommended).toBe(true);
		expect(new Set(gl.map((g) => g.guideline.id)).size).toBe(3);
	});

	it('keeps each guidance catalog as its own group + rolls up overall coverage', () => {
		const nist: GemaraGuideline[] = [
			{ id: 'AC-3', title: 'Access Enforcement' },
			{ id: 'SC-7', title: 'Boundary Protection' },
		];
		const nistControls: GemaraControl[] = [
			{ id: 'CTL.AC', title: 'enforce', guidelines: [{ catalogId: 'nist-800-53', entryIds: ['AC-3'] }] },
		];
		const v = buildGovernanceView({
			guidanceCatalogs: [aigf(), { id: 'nist-800-53', title: 'NIST 800-53', guidelines: nist }],
			controlCatalogs: [{ id: 'ccc.marefarc.cn', controls }, { id: 'ctl', controls: nistControls }],
		});
		expect(v.guidanceCatalogs.map((c) => c.id)).toEqual(['finos-air', 'nist-800-53']);
		expect(v.guidanceCatalogs[0]!.coverage).toEqual({ withControls: 2, total: 3 });
		expect(v.guidanceCatalogs[1]!.coverage).toEqual({ withControls: 1, total: 2 });
		expect(v.coverage).toEqual({ withControls: 3, total: 5 }); // rolled up across catalogs
	});

	it('arch scope (no recommendations) keeps original guidance order', () => {
		const v = buildGovernanceView({ guidanceCatalogs: [aigf()], controlCatalogs: [] });
		const gl = v.guidanceCatalogs[0]!.guidelines;
		expect(gl.map((g) => g.guideline.id)).toEqual(['AIR-PREV-002', 'AIR-DET-001', 'AIR-PREV-014']);
		expect(gl.every((g) => !g.recommended)).toBe(true);
		expect(v.coverage.withControls).toBe(0);
	});
});
