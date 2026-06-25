// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * governanceModel.ts — pure join of guidance (AIGF) and controls (CCC) into the
 * connected view. The connection is canonical: each control declares the
 * guideline(s) it satisfies (`control.guidelines`), so we index controls by
 * guideline id and surface, per guideline, the controls that implement it.
 *
 * No Svelte/DOM — unit-testable.
 */

import type { GemaraControl, GemaraGuideline } from '@calmstudio/calm-core';

/** A control (from some catalog) that satisfies a guideline. */
export interface GovernanceControl {
	catalogId: string;
	control: GemaraControl;
	/** Durable citation for the control catalog (for the attestation requirement-url). */
	citationUrl?: string;
}

/** A guideline with the controls that satisfy it (+ whether it's recommended). */
export interface GovernanceGuideline {
	guideline: GemaraGuideline;
	recommended: boolean;
	controls: GovernanceControl[];
}

/** One guidance catalog (AIGF, NIST 800-53…) with its joined guidelines. */
export interface GovernanceCatalogGroup {
	/** The guidance catalog's id (matches the gemara-link catalog.id). */
	id: string;
	title: string;
	guidelines: GovernanceGuideline[];
	coverage: { withControls: number; total: number };
}

export interface GovernanceView {
	/** One group per attached guidance catalog (the folding unit in the UI). */
	guidanceCatalogs: GovernanceCatalogGroup[];
	/** Overall guidelines-with-controls across all guidance catalogs. */
	coverage: { withControls: number; total: number };
}

export interface ControlCatalogInput {
	/** The control catalog's id (e.g. 'ccc.marefarc.cn'). */
	id: string;
	controls: GemaraControl[];
	/** Durable citation (e.g. the catalog's grc.store hub URL). */
	citationUrl?: string;
}

/** A guidance catalog and the guidelines it contributes. */
export interface GuidanceCatalogInput {
	id: string;
	title: string;
	guidelines: GemaraGuideline[];
}

export interface BuildGovernanceViewInput {
	guidanceCatalogs: GuidanceCatalogInput[];
	/** Guideline ids recommended for the selected node-type ('' set ⇒ arch scope). */
	recommendedIds?: ReadonlySet<string>;
	controlCatalogs: ControlCatalogInput[];
}

/**
 * Index controls by the guideline ids they reference, then present each guidance
 * catalog as its own group — guidelines recommended-first, with the controls that
 * satisfy them nested underneath (the canonical control.guidelines join). Controls
 * from any catalog can satisfy guidelines from any catalog.
 */
export function buildGovernanceView(input: BuildGovernanceViewInput): GovernanceView {
	const recommended = input.recommendedIds ?? new Set<string>();

	const byGuideline = new Map<string, GovernanceControl[]>();
	for (const cat of input.controlCatalogs) {
		for (const control of cat.controls) {
			for (const ref of control.guidelines ?? []) {
				for (const gid of ref.entryIds) {
					const gc: GovernanceControl = {
						catalogId: cat.id,
						control,
						...(cat.citationUrl !== undefined ? { citationUrl: cat.citationUrl } : {}),
					};
					const list = byGuideline.get(gid);
					if (list) list.push(gc);
					else byGuideline.set(gid, [gc]);
				}
			}
		}
	}

	const guidanceCatalogs: GovernanceCatalogGroup[] = input.guidanceCatalogs.map((cat) => {
		const guidelines: GovernanceGuideline[] = cat.guidelines
			.map((g) => ({
				guideline: g,
				recommended: recommended.has(g.id),
				controls: byGuideline.get(g.id) ?? [],
			}))
			// recommended first, otherwise stable (original guidance order).
			.sort((a, b) => Number(b.recommended) - Number(a.recommended));
		const withControls = guidelines.filter((g) => g.controls.length > 0).length;
		return { id: cat.id, title: cat.title, guidelines, coverage: { withControls, total: guidelines.length } };
	});

	const coverage = guidanceCatalogs.reduce(
		(acc, c) => ({
			withControls: acc.withControls + c.coverage.withControls,
			total: acc.total + c.coverage.total,
		}),
		{ withControls: 0, total: 0 },
	);
	return { guidanceCatalogs, coverage };
}
