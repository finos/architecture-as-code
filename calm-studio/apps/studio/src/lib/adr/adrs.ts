// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Document-level CALM `adrs` links (R87–R88).
 */

import {
	fileDir,
	isHttpHref,
	posixRelative,
	resolveRelativeProjectPath,
} from '$lib/explorer/rewriteDetailedArchitecture';
import { hubResourceUrl } from '$lib/hub/hubClient';

export interface HubAdrOptionView {
	name: string;
	description: string;
	positive: string[];
	negative: string[];
}

export interface HubAdrView {
	title: string;
	status: string;
	created: string;
	updated: string;
	context: string;
	drivers: string[];
	options: HubAdrOptionView[];
	outcome: (HubAdrOptionView & { rationale: string }) | null;
	links: { rel: string; href: string }[];
}

export interface AdrPreviewModel {
	ref: string;
	kind: 'markdown' | 'hub' | 'none';
	title: string;
	markdown?: string;
	/** Latest Hub ADR body, unwrapped from `{ adr: ... }` (same document Hub renders). */
	hub?: HubAdrView;
	error?: string;
}

export function readAdrs(model: { adrs?: unknown } | null | undefined): string[] {
	if (!model || !Array.isArray(model.adrs)) return [];
	return model.adrs.filter((item): item is string => typeof item === 'string');
}

export function addAdr(adrs: string[], value: string): { adrs: string[]; duplicate: boolean } {
	const trimmed = value.trim();
	if (!trimmed) return { adrs, duplicate: false };
	if (adrs.includes(trimmed)) return { adrs, duplicate: true };
	return { adrs: [...adrs, trimmed], duplicate: false };
}

export function removeAdr(adrs: string[], index: number): string[] {
	if (index < 0 || index >= adrs.length) return adrs;
	return adrs.filter((_, i) => i !== index);
}

/** Empty replacement is rejected. Returns null when the edit must be ignored. */
export function replaceAdr(adrs: string[], index: number, value: string): string[] | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (index < 0 || index >= adrs.length) return adrs;
	if (adrs[index] === trimmed) return adrs;
	const next = adrs.slice();
	next[index] = trimmed;
	return next;
}

export function moveAdr(adrs: string[], index: number, direction: -1 | 1): string[] {
	const target = index + direction;
	if (index < 0 || index >= adrs.length || target < 0 || target >= adrs.length) return adrs;
	const next = adrs.slice();
	const [item] = next.splice(index, 1);
	next.splice(target, 0, item!);
	return next;
}

export function adrPreviewKind(ref: string): AdrPreviewModel['kind'] {
	const trimmed = ref.trim();
	if (isHttpHref(trimmed)) return 'hub';
	if (trimmed.toLowerCase().endsWith('.md')) return 'markdown';
	return 'none';
}

export function adrTabLabel(ref: string, title?: string): string {
	const named = title?.trim();
	if (named) return named;
	const clean = ref.trim().split('?')[0]?.replace(/\/+$/, '') ?? ref;
	const segment = clean.split('/').pop();
	return segment || ref.trim() || 'ADR';
}

/** Hub ADR URL with no revision segment. View loads the latest revision. */
export function hubAdrUrl(hubUrl: string, namespace: string, id: string): string {
	return hubResourceUrl(hubUrl, 'adrs', namespace, id);
}

/** Path stored in `adrs`, relative to the architecture file. */
export function adrRelativeToFile(fromArchitectureFile: string, projectRelativeTarget: string): string {
	return posixRelative(fileDir(fromArchitectureFile), projectRelativeTarget);
}

/** Stable tab key: Hub URL, or the project-relative path of a local file. */
export function adrTabKey(ref: string, fromArchitectureFile: string | null): string {
	const trimmed = ref.trim();
	if (isHttpHref(trimmed)) return trimmed;
	if (!fromArchitectureFile) return trimmed;
	return resolveRelativeProjectPath(fromArchitectureFile, trimmed) ?? trimmed;
}

function textOf(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => textOf(item)).filter((item): item is string => !!item);
}

function optionView(value: unknown): HubAdrOptionView | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const name = textOf(rec['name']);
	if (!name) return null;
	return {
		name,
		description: textOf(rec['description']) ?? '',
		positive: stringList(rec['positiveConsequences']),
		negative: stringList(rec['negativeConsequences']),
	};
}

/** Hub GET returns `{ namespace, id, revision, adr }`. A bare ADR body is accepted too. */
export function hubAdrBody(doc: Record<string, unknown>): Record<string, unknown> {
	return asRecord(doc['adr']) ?? doc;
}

export function parseHubAdr(doc: Record<string, unknown>): HubAdrView {
	const body = hubAdrBody(doc);
	const outcome = asRecord(body['decisionOutcome']);
	const chosen = outcome ? optionView(outcome['chosenOption']) : null;
	const links = Array.isArray(body['links'])
		? body['links']
				.map((link) => {
					const rec = asRecord(link);
					if (!rec) return null;
					const href = textOf(rec['href']);
					if (!href) return null;
					return { rel: textOf(rec['rel']) ?? href, href };
				})
				.filter((link): link is { rel: string; href: string } => !!link)
		: [];
	return {
		title: textOf(body['title']) ?? '',
		status: textOf(body['status']) ?? '',
		created: textOf(body['creationDateTime']) ?? '',
		updated: textOf(body['updateDateTime']) ?? '',
		context: textOf(body['contextAndProblemStatement']) ?? '',
		drivers: stringList(body['decisionDrivers']),
		options: Array.isArray(body['consideredOptions'])
			? body['consideredOptions']
					.map((option) => optionView(option))
					.filter((option): option is HubAdrOptionView => !!option)
			: [],
		outcome: chosen ? { ...chosen, rationale: textOf(outcome?.['rationale']) ?? '' } : null,
		links,
	};
}

export function previewFromMarkdown(ref: string, markdown: string): AdrPreviewModel {
	const titleLine = markdown.split('\n').find((line) => line.startsWith('# '));
	const title = adrTabLabel(ref, titleLine?.replace(/^#\s+/, ''));
	return { ref, kind: 'markdown', title, markdown };
}

export function previewFromHub(ref: string, doc: Record<string, unknown>): AdrPreviewModel {
	const hub = parseHubAdr(doc);
	const title = adrTabLabel(ref, hub.title || undefined);
	return { ref, kind: 'hub', title, hub };
}

export async function loadAdrPreview(
	ref: string,
	fromArchitectureFile: string | null,
	deps: {
		readText: (projectRelativePath: string) => Promise<string>;
		fetchHub: (url: string) => Promise<Record<string, unknown>>;
	}
): Promise<AdrPreviewModel> {
	const trimmed = ref.trim();
	const kind = adrPreviewKind(trimmed);
	try {
		if (kind === 'markdown') {
			const path = fromArchitectureFile
				? resolveRelativeProjectPath(fromArchitectureFile, trimmed)
				: trimmed;
			if (!path) return previewUnavailable(trimmed, 'Could not resolve this ADR path.');
			return previewFromMarkdown(trimmed, await deps.readText(path));
		}
		if (kind === 'hub') {
			return previewFromHub(trimmed, await deps.fetchHub(trimmed));
		}
		return previewUnavailable(trimmed);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Could not open this ADR.';
		return previewUnavailable(trimmed, message);
	}
}

export function previewUnavailable(ref: string, error?: string): AdrPreviewModel {
	return {
		ref,
		kind: adrPreviewKind(ref) === 'hub' ? 'hub' : adrPreviewKind(ref),
		title: adrTabLabel(ref),
		...(error ? { error } : {}),
	};
}
