// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * export.ts — Export functions for all supported formats.
 *
 * - exportAsCalm: Downloads the current CALM JSON model.
 * - exportAsSvg: Captures the canvas viewport as SVG via html-to-image.
 * - exportAsPng: Captures the canvas viewport as PNG (2x Retina).
 * - exportAsCalmscript: Stub — downloads calmscript content (Phase 5 will fully implement DSL).
 * - exportAsScalerToml: Downloads a Scaler.toml config for OpenGRIS architectures.
 * - downloadDataUrl: Low-level helper for data URL downloads.
 *
 * SVG/PNG export requires a real browser (jsdom cannot render computed styles).
 * All functions are async-safe; null-guard on viewport element per RESEARCH Pitfall 3.
 */

import { toSvg, toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/svelte';
import type { Node } from '@xyflow/svelte';
import { downloadDataUrl } from '$lib/io/fileSystem';
import {
	detectPacksFromArch,
	buildSidecarData,
	sidecarNameFor,
	buildDecoratorSidecarData,
	decoratorSidecarNameFor,
} from '$lib/io/sidecar';
import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';
import { buildScalerToml } from '$lib/io/scalerToml';
import { writeDocumentName } from '$lib/io/documentName';
import { writeLayout, type DiagramLayout } from '$lib/io/diagramLayout';
import { buildZip, type ZipEntry } from '$lib/io/zip';

const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;

/** Canonical CALM 1.2 meta-schema URL written into exported documents. */
export const CALM_SCHEMA_URL = 'https://calm.finos.org/release/1.2/meta/calm.json';

// ─── Write finalization (shared by Save / Save As / Export) ───────────────────

/**
 * Finalize a CALM JSON string for writing to disk — applied by every CALM-JSON
 * writer (Save, Save As, Export) so the file is canonical regardless of which
 * action produced it.
 *
 * - Strips Studio-internal `_template` scratch metadata (must never persist).
 * - Strips `decorators` — they are written to the `*.decorators.json` sidecar
 *   instead of being embedded (a decorator's required `target` references the
 *   architecture from the outside, so it cannot live inside it). Use
 *   `buildDecoratorSidecar` on the same source JSON to capture them.
 * - Injects the canonical CALM 1.2 `$schema` when absent, so written files are
 *   self-describing and version-pinned; an existing `$schema` is left untouched.
 * - When `documentName` is supplied, persists it under `metadata.name` so the
 *   document title survives content-only round trips (paste / templates / Hub),
 *   not just the OS filename. Pass `undefined` to leave the name untouched.
 * - When `layout` is supplied, persists the node-position map under
 *   `metadata.calmstudio-layout` so the user's arrangement is restored on load.
 *   Pass `undefined` to leave it untouched.
 *
 * Both annotations live in `metadata` (the canonical free-form slot) and are
 * ignored by non-Studio CALM consumers. Pure string→string; returns the input
 * unchanged if the JSON is malformed.
 */
export function finalizeCalmForWrite(
	json: string,
	documentName?: string | null,
	layout?: DiagramLayout,
): string {
	try {
		const parsed = JSON.parse(json) as CalmArchitecture & { _template?: unknown; $schema?: string };
		if ('_template' in parsed) {
			delete parsed._template;
		}
		if ('decorators' in parsed) {
			delete (parsed as { decorators?: unknown }).decorators;
		}
		if (!parsed['$schema']) {
			parsed['$schema'] = CALM_SCHEMA_URL;
		}
		if (documentName !== undefined || layout !== undefined) {
			let meta: unknown = parsed.metadata;
			if (documentName !== undefined) meta = writeDocumentName(meta, documentName);
			if (layout !== undefined) meta = writeLayout(meta, layout);
			if (meta === undefined) delete (parsed as { metadata?: unknown }).metadata;
			else (parsed as { metadata?: unknown }).metadata = meta;
		}
		return JSON.stringify(parsed, null, 2);
	} catch {
		// Malformed JSON — return original; the caller's write still proceeds.
		return json;
	}
}

/**
 * Build the `*.decorators.json` sidecar JSON for an architecture's decorators,
 * stamping each decorator's `target` to the architecture filename so it points
 * at the file it sits beside. Returns `null` when the architecture has no
 * decorators (no sidecar is written in that case). Read from the SAME source
 * JSON passed to `finalizeCalmForWrite` — that call strips `decorators`, this
 * one captures them.
 *
 * @param json          Pretty-printed JSON string from getModelJson()
 * @param archFileName  Filename the architecture is being saved as
 */
export function buildDecoratorSidecar(json: string, archFileName: string): string | null {
	try {
		const parsed = JSON.parse(json) as { decorators?: CalmDecorator[] };
		const decorators = parsed.decorators ?? [];
		if (decorators.length === 0) return null;
		return JSON.stringify(buildDecoratorSidecarData(decorators, archFileName), null, 2);
	} catch {
		return null;
	}
}

// ─── CALM JSON export ─────────────────────────────────────────────────────────

/**
 * Export the current CALM architecture as a .calm.json file.
 *
 * If the architecture contains extension pack nodes (colon-prefixed node types),
 * a second download is triggered for the companion .calmstudio.json sidecar file.
 * Diagrams with only core CALM types do NOT get a sidecar.
 *
 * NB: this is the "hand a clean CALM file to another tool" path, so it
 * deliberately does NOT persist Studio's metadata annotations (document name,
 * diagram layout) — `finalizeCalmForWrite` is called WITHOUT them. Save / Save As
 * are the "preserve my work" path and pass both. Do not "fix" this by adding them
 * here without intending Studio annotations to travel in consumer-facing exports.
 *
 * @param json      Pretty-printed JSON string from getModelJson()
 * @param filename  Output filename (default: architecture.calm.json)
 */
export function exportAsCalm(json: string, filename = 'architecture.calm.json'): void {
	// Apply the shared finalize pass (strip _template/decorators, inject $schema) —
	// name/layout intentionally omitted (see the note above).
	const cleanJson = finalizeCalmForWrite(json);

	const blob = new Blob([cleanJson], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	downloadDataUrl(url, filename);
	// Note: URL.revokeObjectURL not needed for data: URLs, but is for blob: URLs.
	// We use a blob: URL here so we revoke after the click microtask.
	setTimeout(() => URL.revokeObjectURL(url), 0);

	// Decorators were stripped from the clean file — emit them as a sidecar so
	// they aren't silently lost. Built from the ORIGINAL json (pre-strip).
	const decoratorSidecar = buildDecoratorSidecar(json, filename);
	if (decoratorSidecar) {
		const decBlob = new Blob([decoratorSidecar], { type: 'application/json' });
		const decUrl = URL.createObjectURL(decBlob);
		setTimeout(() => {
			downloadDataUrl(decUrl, decoratorSidecarNameFor(filename));
			setTimeout(() => URL.revokeObjectURL(decUrl), 0);
		}, 100);
	}

	// Check if the architecture uses extension pack types — if so, export sidecar too.
	try {
		const arch = JSON.parse(cleanJson) as CalmArchitecture;
		const packIds = detectPacksFromArch(arch);
		if (packIds.length > 0) {
			const sidecarData = buildSidecarData(packIds);
			const sidecarJson = JSON.stringify(sidecarData, null, 2);
			const sidecarFilename = sidecarNameFor(filename);
			const sidecarBlob = new Blob([sidecarJson], { type: 'application/json' });
			const sidecarUrl = URL.createObjectURL(sidecarBlob);
			// Small delay so the browser doesn't block the second download
			setTimeout(() => {
				downloadDataUrl(sidecarUrl, sidecarFilename);
				setTimeout(() => URL.revokeObjectURL(sidecarUrl), 0);
			}, 200);
		}
	} catch {
		// Ignore JSON parse errors — main file was already exported
	}
}

// ─── Design zip export (arch + sidecars in one file) ─────────────────────────

/** Derive the design-zip filename from the architecture filename. */
export function designZipNameFor(archFileName: string): string {
	const base = archFileName.endsWith('.json') ? archFileName.slice(0, -5) : archFileName;
	return base + '.zip';
}

/**
 * Export the whole design — the clean architecture plus its `*.decorators.json`
 * and `*.calmstudio.json` sidecars — as a single `.zip`. This is the portable,
 * browser-friendly way to keep the architecture and its decorator overlay
 * together (a plain single-file Save splits them into siblings, which the
 * browser can't re-read on open). Each member is individually consumable once
 * unzipped, so the decorators' `target` file-path references stay valid.
 *
 * Layout and document name are preserved (like Save) so the design reopens as
 * arranged — the zip is a faithful snapshot, not a stripped export.
 *
 * @param json          Pretty-printed JSON string from getModelJson()
 * @param archFileName  Architecture filename to use inside the archive
 * @param documentName  Persisted under metadata.name (omit to leave untouched)
 * @param layout        Node-position map persisted under metadata.calmstudio-layout
 */
export function buildDesignZipEntries(
	json: string,
	archFileName = 'architecture.calm.json',
	documentName?: string | null,
	layout?: DiagramLayout,
): ZipEntry[] {
	const entries: ZipEntry[] = [
		{ name: archFileName, content: finalizeCalmForWrite(json, documentName, layout) },
	];

	const decoratorSidecar = buildDecoratorSidecar(json, archFileName);
	if (decoratorSidecar) {
		entries.push({ name: decoratorSidecarNameFor(archFileName), content: decoratorSidecar });
	}

	try {
		const arch = JSON.parse(entries[0].content) as CalmArchitecture;
		const packIds = detectPacksFromArch(arch);
		if (packIds.length > 0) {
			entries.push({
				name: sidecarNameFor(archFileName),
				content: JSON.stringify(buildSidecarData(packIds), null, 2),
			});
		}
	} catch {
		// Ignore — the architecture entry is already queued.
	}

	return entries;
}

export function exportDesignAsZip(
	json: string,
	archFileName = 'architecture.calm.json',
	documentName?: string | null,
	layout?: DiagramLayout,
): void {
	const entries = buildDesignZipEntries(json, archFileName, documentName, layout);
	const bytes = buildZip(entries);
	const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
	const url = URL.createObjectURL(blob);
	downloadDataUrl(url, designZipNameFor(archFileName));
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── SVG export ───────────────────────────────────────────────────────────────

/**
 * Export the canvas as an SVG file with transparent background.
 *
 * Captures the `.svelte-flow__viewport` element via html-to-image.
 * Requires a real browser — jsdom cannot render canvas styles.
 *
 * @param nodes  Current Svelte Flow nodes (used to compute viewport bounds)
 */
export async function exportAsSvg(nodes: Node[]): Promise<void> {
	const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement | null;
	if (!viewportEl) {
		console.error('[CalmStudio] SVG export failed: .svelte-flow__viewport not found in DOM');
		return;
	}

	const bounds = getNodesBounds(nodes);
	const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

	const dataUrl = await toSvg(viewportEl, {
		backgroundColor: 'transparent',
		width: IMAGE_WIDTH,
		height: IMAGE_HEIGHT,
		style: {
			width: `${IMAGE_WIDTH}px`,
			height: `${IMAGE_HEIGHT}px`,
			transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
		},
	});

	downloadDataUrl(dataUrl, 'architecture.svg');
}

// ─── PNG export ───────────────────────────────────────────────────────────────

/**
 * Export the canvas as a PNG file at 2x resolution (Retina).
 *
 * Captures the `.svelte-flow__viewport` element via html-to-image.
 * Requires a real browser — jsdom cannot render canvas styles.
 *
 * @param nodes  Current Svelte Flow nodes (used to compute viewport bounds)
 */
export async function exportAsPng(nodes: Node[]): Promise<void> {
	const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement | null;
	if (!viewportEl) {
		console.error('[CalmStudio] PNG export failed: .svelte-flow__viewport not found in DOM');
		return;
	}

	const bounds = getNodesBounds(nodes);
	const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

	const dataUrl = await toPng(viewportEl, {
		backgroundColor: 'transparent',
		width: IMAGE_WIDTH,
		height: IMAGE_HEIGHT,
		pixelRatio: 2,
		style: {
			width: `${IMAGE_WIDTH}px`,
			height: `${IMAGE_HEIGHT}px`,
			transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
		},
	});

	downloadDataUrl(dataUrl, 'architecture.png');
}

// ─── calmscript export (stub) ─────────────────────────────────────────────────

/**
 * Export the current calmscript view content as a .calmscript file.
 *
 * Phase 4 stub: accepts the content string currently shown in the code panel.
 * Will be fully functional after Phase 5 implements the calmscript DSL compiler.
 *
 * @param content  Current calmscript view content string from the code panel
 */
export function exportAsCalmscript(content: string): void {
	const blob = new Blob([content], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	downloadDataUrl(url, 'architecture.calmscript');
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── Scaler.toml export ───────────────────────────────────────────────────────

/**
 * Export the current CALM architecture as a Scaler.toml configuration file.
 * Only meaningful when the architecture contains OpenGRIS nodes.
 *
 * @param arch      The CALM architecture to export
 * @param filename  Output filename (default: scaler.toml)
 */
export function exportAsScalerToml(arch: CalmArchitecture, filename = 'scaler.toml'): void {
	const content = buildScalerToml(arch);
	const blob = new Blob([content], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	downloadDataUrl(url, filename);
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
