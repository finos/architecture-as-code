// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * CALM architecture → Mermaid flowchart (R85).
 * Containers (composed-of / deployed-in) become subgraphs; containment is not drawn as edges.
 */

import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import {
	getActorAndNodes,
	getConnectsEndpoints,
	getContainerAndNodes,
	getRelationshipVariant,
} from '@calmstudio/calm-core';

/** Sanitize a CALM unique-id into a Mermaid node / subgraph id. */
export function sanitizeMermaidId(id: string): string {
	const cleaned = id.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
	const base = cleaned.length > 0 ? cleaned : 'node';
	return /^[A-Za-z]/.test(base) ? base : `n_${base}`;
}

/** Escape a label for use inside Mermaid `["…"]`. */
export function escapeMermaidLabel(label: string): string {
	return label.replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim();
}

function nodeLabel(node: CalmNode): string {
	const name = typeof node.name === 'string' ? node.name.trim() : '';
	return escapeMermaidLabel(name || node['unique-id']);
}

/** Build container → children from composed-of / deployed-in (merged). */
export function buildContainmentMap(relationships: CalmRelationship[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const rel of relationships) {
		const variant = getRelationshipVariant(rel['relationship-type']);
		if (variant !== 'composed-of' && variant !== 'deployed-in') continue;
		const cn = getContainerAndNodes(rel);
		if (!cn?.container) continue;
		const existing = map.get(cn.container) ?? [];
		for (const child of cn.nodes) {
			if (child && !existing.includes(child)) existing.push(child);
		}
		map.set(cn.container, existing);
	}
	return map;
}

function emitNodeLine(id: string, label: string, indent: string): string {
	return `${indent}${id}["${label}"]`;
}

/**
 * Emit flowchart body lines for a set of nodes, nesting containers as subgraphs.
 */
function emitNodes(
	nodeIds: string[],
	byId: Map<string, CalmNode>,
	childrenOf: Map<string, string[]>,
	childSet: Set<string>,
	indent: string,
	visitedContainers: Set<string>
): string[] {
	const lines: string[] = [];
	for (const rawId of nodeIds) {
		const node = byId.get(rawId);
		if (!node) continue;
		const mid = sanitizeMermaidId(rawId);
		const kids = childrenOf.get(rawId);
		if (kids && kids.length > 0) {
			if (visitedContainers.has(rawId)) continue;
			visitedContainers.add(rawId);
			lines.push(`${indent}subgraph ${mid}["${nodeLabel(node)}"]`);
			lines.push(...emitNodes(kids, byId, childrenOf, childSet, `${indent}  `, visitedContainers));
			lines.push(`${indent}end`);
		} else {
			lines.push(emitNodeLine(mid, nodeLabel(node), indent));
		}
	}
	return lines;
}

function emitEdges(relationships: CalmRelationship[]): string[] {
	const lines: string[] = [];
	for (const rel of relationships) {
		const variant = getRelationshipVariant(rel['relationship-type']);
		if (variant === 'composed-of' || variant === 'deployed-in' || variant === 'options') {
			continue;
		}
		const edgeLabel = escapeMermaidLabel(variant);
		if (variant === 'connects') {
			const ends = getConnectsEndpoints(rel);
			if (!ends) continue;
			lines.push(
				`  ${sanitizeMermaidId(ends.source)} -->|${edgeLabel}| ${sanitizeMermaidId(ends.destination)}`
			);
			continue;
		}
		if (variant === 'interacts') {
			const an = getActorAndNodes(rel);
			if (!an) continue;
			const actor = sanitizeMermaidId(an.actor);
			for (const n of an.nodes) {
				lines.push(`  ${actor} -->|${edgeLabel}| ${sanitizeMermaidId(n)}`);
			}
		}
	}
	return lines;
}

/**
 * Convert a CALM architecture to Mermaid flowchart source (no Markdown fence).
 */
export function architectureToMermaid(arch: CalmArchitecture): string {
	const byId = new Map(arch.nodes.map((n) => [n['unique-id'], n]));
	const childrenOf = buildContainmentMap(arch.relationships);
	const childSet = new Set<string>();
	for (const kids of childrenOf.values()) {
		for (const c of kids) childSet.add(c);
	}

	const topLevel = arch.nodes
		.map((n) => n['unique-id'])
		.filter((id) => !childSet.has(id));

	const visitedContainers = new Set<string>();
	const nodeLines = emitNodes(topLevel, byId, childrenOf, childSet, '  ', visitedContainers);

	// Orphan children whose parent is missing from the architecture
	for (const n of arch.nodes) {
		const id = n['unique-id'];
		if (!childSet.has(id)) continue;
		const mid = sanitizeMermaidId(id);
		const already =
			nodeLines.some((l) => l.includes(`${mid}["`) || l.includes(`subgraph ${mid}[`));
		if (already) continue;
		// Parent missing — emit at top level
		const kids = childrenOf.get(id);
		if (kids && kids.length > 0 && !visitedContainers.has(id)) {
			visitedContainers.add(id);
			nodeLines.push(`  subgraph ${mid}["${nodeLabel(n)}"]`);
			nodeLines.push(...emitNodes(kids, byId, childrenOf, childSet, '    ', visitedContainers));
			nodeLines.push('  end');
		} else if (!kids?.length) {
			nodeLines.push(emitNodeLine(mid, nodeLabel(n), '  '));
		}
	}

	const edgeLines = emitEdges(arch.relationships);
	const parts = ['flowchart TB', ...nodeLines];
	if (edgeLines.length > 0) {
		parts.push('');
		parts.push(...edgeLines);
	}
	return parts.join('\n') + '\n';
}

/** Wrap Mermaid source in a Markdown fenced block. */
export function architectureToMermaidMarkdown(arch: CalmArchitecture): string {
	const body = architectureToMermaid(arch).trimEnd();
	return `\`\`\`mermaid\n${body}\n\`\`\`\n`;
}
