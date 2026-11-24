// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import type { Node } from '@xyflow/svelte';

export const RELATIONSHIP_HOVER_CLASS = 'calm-rel-hover';

function classToString(cls: Node['class']): string {
	if (!cls) return '';
	if (typeof cls === 'string') return cls;
	if (Array.isArray(cls)) {
		return cls.flatMap((item) => (typeof item === 'string' ? [item] : [])).join(' ');
	}
	if (typeof cls === 'object') {
		return Object.entries(cls)
			.filter(([, on]) => Boolean(on))
			.map(([name]) => name)
			.join(' ');
	}
	return '';
}

function withoutHover(cls: Node['class']): string {
	return classToString(cls)
		.split(/\s+/)
		.filter((token) => token && token !== RELATIONSHIP_HOVER_CLASS)
		.join(' ');
}

/** Mark the two endpoints of the hovered relationship. Other node classes stay. */
export function applyRelationshipHoverClass(
	nodes: Node[],
	source: string | null,
	target: string | null,
): Node[] {
	let changed = false;
	const next = nodes.map((node) => {
		const lit = node.id === source || node.id === target;
		const base = withoutHover(node.class);
		const nextClass = lit ? `${base} ${RELATIONSHIP_HOVER_CLASS}`.trim() : base;
		if (nextClass === classToString(node.class)) return node;
		changed = true;
		return { ...node, class: nextClass || undefined };
	});
	return changed ? next : nodes;
}
