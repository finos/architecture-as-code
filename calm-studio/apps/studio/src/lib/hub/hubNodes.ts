// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { corePack, resolvePackNode } from '@calmstudio/extensions';

export interface HubTreeNodePreview {
	uniqueId: string;
	name: string;
	nodeType: string;
	description: string;
	/** Present when this Hub node is itself a reference (R82). */
	detailedArchitecture?: string;
}

/** Nodes listed under a Hub architecture version (R78). */
export function hubNodesFromArchitecture(doc: unknown): HubTreeNodePreview[] {
	if (!doc || typeof doc !== 'object') return [];
	const nodes = (doc as { nodes?: unknown }).nodes;
	if (!Array.isArray(nodes)) return [];
	const out: HubTreeNodePreview[] = [];
	for (const node of nodes) {
		if (!node || typeof node !== 'object') continue;
		const rec = node as Record<string, unknown>;
		const uniqueId = typeof rec['unique-id'] === 'string' ? rec['unique-id'] : '';
		if (!uniqueId) continue;
		const details = rec.details;
		let detailedArchitecture: string | undefined;
		if (details && typeof details === 'object') {
			const href = (details as Record<string, unknown>)['detailed-architecture'];
			if (typeof href === 'string' && href.trim()) detailedArchitecture = href.trim();
		}
		out.push({
			uniqueId,
			name: typeof rec['name'] === 'string' && rec['name'] ? rec['name'] : uniqueId,
			nodeType: typeof rec['node-type'] === 'string' ? rec['node-type'] : 'system',
			description: typeof rec['description'] === 'string' ? rec['description'] : '',
			...(detailedArchitecture ? { detailedArchitecture } : {}),
		});
	}
	return out;
}

/** Inline SVG for a CALM node-type. Core types have no pack prefix. */
export function nodeTypeIconMarkup(nodeType: string): string {
	if (!nodeType) return '';
	if (nodeType.includes(':')) return resolvePackNode(nodeType)?.icon ?? '';
	return corePack.nodes.find((node) => node.typeId === nodeType)?.icon ?? '';
}
