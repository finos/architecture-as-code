// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
// SPDX-License-Identifier: Apache-2.0

/**
 * edgeTypes.ts — Registration map for CALM relationship edge components.
 *
 * Pass this object to <SvelteFlow edgeTypes={edgeTypes} /> so @xyflow/svelte
 * renders the correct custom component for each CALM relationship type.
 * DEFAULT_EDGE_TYPE is used when creating new edges without an explicit type.
 */

import ConnectsEdge from './edges/ConnectsEdge.svelte';
import InteractsEdge from './edges/InteractsEdge.svelte';
import DeployedInEdge from './edges/DeployedInEdge.svelte';
import ComposedOfEdge from './edges/ComposedOfEdge.svelte';
import OptionsEdge from './edges/OptionsEdge.svelte';

/** Maps CALM relationship type strings to their Svelte edge components. */
export const edgeTypes = {
	connects: ConnectsEdge,
	interacts: InteractsEdge,
	'deployed-in': DeployedInEdge,
	'composed-of': ComposedOfEdge,
	options: OptionsEdge,
} as const;

/**
 * Default edge type for newly created edges.
 * "connects" is the most common CALM relationship type — used when the
 * user draws an edge without explicitly choosing a relationship type.
 */
export const DEFAULT_EDGE_TYPE = 'connects' as const;
