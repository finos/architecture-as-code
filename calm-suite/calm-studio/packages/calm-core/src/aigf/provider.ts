// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Built-in guidance providers. A GuidanceProvider exposes a Gemara guidance
 * catalog plus the optional "built-in advantages": node-type → recommended
 * guideline applicability. AIGF is the first built-in; it's bundled OFFLINE so
 * it works with no network. Ad-hoc (fetched/pasted) catalogs implement only the
 * guideline list and get no node-type recommendations.
 *
 * "More built-ins later" = add another provider to BUILTIN_GUIDANCE_PROVIDERS.
 */

import type { GemaraCatalogRef, GemaraGuideline } from '../gemara/types.js';
import { FINOS_AIR } from './finos-air.data.js';
import { AIGF_NODE_GUIDELINES } from './applicability.data.js';

export interface GuidanceProvider {
  /** Stable provider id, e.g. 'aigf'. */
  id: string;
  /** Human label. */
  label: string;
  /** The guidance catalog coordinate (for citation / display). */
  catalogRef: GemaraCatalogRef;
  /** The guideline entries. */
  guidelines(): GemaraGuideline[];
  /** Optional: guideline ids recommended for a CALM node-type (built-in only). */
  recommendedGuidelineIds?(nodeType: string): string[];
}

/** FINOS AI Governance Framework — bundled offline guidance built-in. */
export const aigfGuidanceProvider: GuidanceProvider = {
  id: 'aigf',
  label: 'FINOS AI Governance Framework',
  catalogRef: {
    namespace: 'finos-aigf',
    catalogId: 'finos-air',
    version: FINOS_AIR.metadata.version ?? '0.2.0',
  },
  guidelines: () => FINOS_AIR.guidelines,
  recommendedGuidelineIds: (nodeType: string) => AIGF_NODE_GUIDELINES[nodeType] ?? [],
};

/** Offline built-in guidance providers (extend with future built-ins). */
export const BUILTIN_GUIDANCE_PROVIDERS: readonly GuidanceProvider[] = [aigfGuidanceProvider];

export function getBuiltinGuidanceProvider(id: string): GuidanceProvider | undefined {
  return BUILTIN_GUIDANCE_PROVIDERS.find((p) => p.id === id);
}
