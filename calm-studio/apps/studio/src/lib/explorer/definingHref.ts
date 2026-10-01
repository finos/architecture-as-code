// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * On insert, point detailed-architecture at the file that defines the node (R82).
 * Follow relative links until the node has none. Copy http(s). Unresolved chains
 * fall back to the document the node was inserted from.
 */

import { relativePathBetween } from './relativePath';
import { isHttpHref, resolveRelativeProjectPath } from './rewriteDetailedArchitecture';
import { readProjectRelativeText } from '$lib/project/projectFs';

export interface DefiningChainNode {
	uniqueId: string;
	detailedArchitecture?: string;
}

export interface DefiningChainDocument {
	id: string;
	nodes: DefiningChainNode[];
}

const MAX_HOPS = 32;

function hrefForDocument(docId: string, currentFile: string | null): string {
	if (isHttpHref(docId)) return docId;
	if (!currentFile) return docId;
	return relativePathBetween(currentFile, docId);
}

function nodeHref(node: DefiningChainNode | undefined): string {
	return node?.detailedArchitecture?.trim() ?? '';
}

export function chainDocumentFromUnknown(id: string, doc: unknown): DefiningChainDocument | null {
	if (!doc || typeof doc !== 'object') return null;
	const nodes = (doc as { nodes?: unknown }).nodes;
	if (!Array.isArray(nodes)) return null;
	const chainNodes: DefiningChainNode[] = [];
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
		chainNodes.push({ uniqueId, detailedArchitecture });
	}
	return { id, nodes: chainNodes };
}

type ChainStep =
	| { kind: 'done'; href: string }
	| { kind: 'follow'; path: string }
	| { kind: 'fallback' };

function chainStep(
	doc: DefiningChainDocument,
	nodeUniqueId: string,
	currentFile: string | null,
	visited: Set<string>
): ChainStep {
	if (visited.has(doc.id)) return { kind: 'fallback' };
	visited.add(doc.id);
	const node = doc.nodes.find((item) => item.uniqueId === nodeUniqueId);
	if (!node) return { kind: 'fallback' };
	const href = nodeHref(node);
	if (!href) return { kind: 'done', href: hrefForDocument(doc.id, currentFile) };
	if (isHttpHref(href)) return { kind: 'done', href };
	if (isHttpHref(doc.id)) return { kind: 'fallback' };
	const nextPath = resolveRelativeProjectPath(doc.id, href);
	if (!nextPath) return { kind: 'fallback' };
	return { kind: 'follow', path: nextPath };
}

function finishStep(step: ChainStep, fallback: string): string | null {
	if (step.kind === 'fallback') return fallback;
	if (step.kind === 'done') return step.href;
	return null;
}

/** In-memory chain. `load` returns null when the next file is missing. */
export function resolveDefiningHref(options: {
	source: DefiningChainDocument;
	nodeUniqueId: string;
	currentFile: string | null;
	load: (projectRelativePath: string) => DefiningChainDocument | null;
}): string {
	const fallback = hrefForDocument(options.source.id, options.currentFile);
	let doc = options.source;
	const visited = new Set<string>();

	for (let hop = 0; hop < MAX_HOPS; hop += 1) {
		const step = chainStep(doc, options.nodeUniqueId, options.currentFile, visited);
		const done = finishStep(step, fallback);
		if (done !== null) return done;
		if (step.kind !== 'follow') return fallback;
		const next = options.load(step.path);
		if (!next) return fallback;
		doc = next;
	}
	return fallback;
}

/** Same walk as {@link resolveDefiningHref}, reading each next file as it is found. */
export async function resolveDefiningHrefAsync(options: {
	source: DefiningChainDocument;
	nodeUniqueId: string;
	currentFile: string | null;
	load: (projectRelativePath: string) => Promise<DefiningChainDocument | null>;
}): Promise<string> {
	const fallback = hrefForDocument(options.source.id, options.currentFile);
	let doc = options.source;
	const visited = new Set<string>();

	for (let hop = 0; hop < MAX_HOPS; hop += 1) {
		const step = chainStep(doc, options.nodeUniqueId, options.currentFile, visited);
		const done = finishStep(step, fallback);
		if (done !== null) return done;
		if (step.kind !== 'follow') return fallback;
		const next = await options.load(step.path);
		if (!next) return fallback;
		doc = next;
	}
	return fallback;
}

export async function resolveDefiningHrefFromProject(options: {
	root: FileSystemDirectoryHandle;
	sourcePath: string;
	nodeUniqueId: string;
	currentFile: string | null;
}): Promise<string> {
	const fallback = options.currentFile
		? relativePathBetween(options.currentFile, options.sourcePath)
		: options.sourcePath;
	const cache = new Map<string, DefiningChainDocument | null>();

	async function load(path: string): Promise<DefiningChainDocument | null> {
		if (cache.has(path)) return cache.get(path) ?? null;
		let doc: DefiningChainDocument | null = null;
		try {
			const text = await readProjectRelativeText(options.root, path);
			doc = chainDocumentFromUnknown(path, JSON.parse(text) as unknown);
		} catch {
			doc = null;
		}
		cache.set(path, doc);
		return doc;
	}

	const source = await load(options.sourcePath);
	if (!source) return fallback;
	return resolveDefiningHrefAsync({
		source,
		nodeUniqueId: options.nodeUniqueId,
		currentFile: options.currentFile,
		load,
	});
}

/** Hub drag: copy an http(s) link; otherwise the version URL is the definition or the fallback. */
export function hubNodeInsertHref(versionUrl: string, nodeDetailedArchitecture?: string): string {
	const href = nodeDetailedArchitecture?.trim() ?? '';
	if (href && isHttpHref(href)) return href;
	return versionUrl;
}
