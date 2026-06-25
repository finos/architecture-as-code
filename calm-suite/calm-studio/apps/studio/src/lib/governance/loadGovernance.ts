// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * loadGovernance — assemble the connected Governance view for an element:
 * incorporated guidance (built-in providers) + control catalogs (loaded full),
 * joined by buildGovernanceView. A node inherits the catalogs incorporated at
 * architecture scope (they apply arch-wide).
 */

import {
	BUILTIN_GUIDANCE_PROVIDERS,
	GEMARA_ARCHITECTURE_SCOPE,
	gemaraLinksForElement,
	type GemaraLink,
} from '@calmstudio/calm-core';
import { getModel } from '$lib/stores/calmModel.svelte';
import { loadControlCatalogFull } from '$lib/stores/gemaraCatalogs';
import { elementScopeChain } from './scope';
import {
	buildGovernanceView,
	type ControlCatalogInput,
	type GuidanceCatalogInput,
	type GovernanceView,
} from './governanceModel';

/**
 * Links governing the element: its own bindings, plus those it inherits from the
 * systems that contain it (the containment chain), plus any legacy `@architecture`
 * bindings.
 */
function effectiveLinks(elementId: string): GemaraLink[] {
	const arch = getModel();
	const decorators = arch.decorators;
	const ids =
		elementId === GEMARA_ARCHITECTURE_SCOPE
			? [GEMARA_ARCHITECTURE_SCOPE]
			: [...elementScopeChain(arch, elementId), GEMARA_ARCHITECTURE_SCOPE];
	const seen = new Set<string>();
	const out: GemaraLink[] = [];
	for (const id of ids) {
		for (const link of gemaraLinksForElement(decorators, id)) {
			if (!seen.has(link.uniqueId)) {
				seen.add(link.uniqueId);
				out.push(link);
			}
		}
	}
	return out;
}

export async function loadGovernance(
	elementId: string,
	nodeType: string | null,
): Promise<GovernanceView> {
	const links = effectiveLinks(elementId);

	// Guidance — one group per attached guidance catalog (matched offline built-in
	// providers; v1: built-ins only). Keeping them grouped lets the UI fold each
	// catalog (AIGF, NIST…) separately rather than interleaving one flat list.
	const guidanceCatalogs: GuidanceCatalogInput[] = [];
	const recommendedIds = new Set<string>();
	for (const g of links.filter((l) => l.artifact === 'guidance')) {
		const provider = BUILTIN_GUIDANCE_PROVIDERS.find((p) => p.catalogRef.catalogId === g.catalog.id);
		if (!provider) continue;
		guidanceCatalogs.push({
			id: g.catalog.id,
			title: g.catalog.title ?? provider.label ?? g.catalog.id,
			guidelines: provider.guidelines(),
		});
		if (nodeType && provider.recommendedGuidelineIds) {
			for (const id of provider.recommendedGuidelineIds(nodeType)) recommendedIds.add(id);
		}
	}

	// Controls — full bodies of incorporated requirements catalogs.
	const controlCatalogs: ControlCatalogInput[] = [];
	for (const r of links.filter((l) => l.artifact === 'requirements')) {
		const namespace = r.catalog.namespace;
		if (!namespace) continue;
		try {
			const cat = await loadControlCatalogFull({
				namespace,
				catalogId: r.catalog.id,
				version: r.catalog.version,
			});
			controlCatalogs.push({
				id: r.catalog.id,
				controls: cat.controls,
				...(r.catalog['hub-url'] ? { citationUrl: r.catalog['hub-url'] } : {}),
			});
		} catch {
			// Skip catalogs that fail to load (offline / hub error).
		}
	}

	return buildGovernanceView({ guidanceCatalogs, recommendedIds, controlCatalogs });
}
