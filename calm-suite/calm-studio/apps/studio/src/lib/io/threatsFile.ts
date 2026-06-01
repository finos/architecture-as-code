// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * threatsFile.ts — Sidecar file utilities for threat-model decorators (#2551).
 *
 * The threats sidecar (`<arch>.threats.calm.json`) stores threat-model and
 * control-catalog decorators alongside the main `.calm.json` architecture
 * file. It is intentionally separated from the architecture for two reasons:
 *
 *   1. Strict CALM 1.2 meta-schema validators (ajv 2020-12 against
 *      `https://calm.finos.org/release/1.2/meta/core.json`) reject any root
 *      key not listed in `properties` — `decorators` is currently absent,
 *      so embedding decorators[] in the arch file fails strict validation.
 *      Tracked upstream in #2552; not a CalmStudio concern.
 *
 *   2. Threat models version independently from the architecture they
 *      annotate — keeping them in a sibling file matches the documented
 *      decorator concept (https://calm.finos.org/core-concepts/decorators)
 *      where decorators reference architecture files via `target[]`.
 *
 * Sidecar shape:
 *
 *   { "decorators": [ ...CalmDecorator[] ] }
 *
 * On load, the decorators are merged into the architecture's
 * `decorators[]` field in memory (the architecture file on disk stays
 * unmodified). On save, decorators of type `threat-model` and
 * `control-catalog` are split back out into the sidecar.
 */

import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';

/** Decorator types that belong in the threats sidecar (not the arch file). */
export const SIDECAR_DECORATOR_TYPES: ReadonlySet<string> = new Set([
	'threat-model',
	'control-catalog'
]);

export interface ThreatsSidecar {
	decorators: CalmDecorator[];
}

/**
 * Derive the threats sidecar filename from the architecture filename.
 *
 *   architecture.calm.json       -> architecture.threats.calm.json
 *   architecture.json            -> architecture.threats.json
 *   my-arch                      -> my-arch.threats
 */
export function threatsSidecarNameFor(archName: string): string {
	if (archName.endsWith('.calm.json')) {
		return archName.slice(0, -'.calm.json'.length) + '.threats.calm.json';
	}
	if (archName.endsWith('.json')) {
		return archName.slice(0, -'.json'.length) + '.threats.json';
	}
	return archName + '.threats';
}

/**
 * Parse a threats sidecar payload. Accepts either a `{ decorators: [...] }`
 * wrapper or a raw decorators array (lenient).
 */
export function parseThreatsSidecar(raw: unknown): ThreatsSidecar {
	if (Array.isArray(raw)) {
		return { decorators: raw as CalmDecorator[] };
	}
	if (raw && typeof raw === 'object' && Array.isArray((raw as ThreatsSidecar).decorators)) {
		return { decorators: (raw as ThreatsSidecar).decorators };
	}
	return { decorators: [] };
}

/**
 * Merge decorators from a threats sidecar into the architecture's
 * in-memory `decorators[]` field. Existing decorators are preserved.
 * Duplicates (by `unique-id`) prefer the existing entry — the sidecar
 * is additive, not destructive.
 */
export function mergeThreatsSidecar(
	arch: CalmArchitecture,
	sidecar: ThreatsSidecar
): CalmArchitecture {
	const existing = arch.decorators ?? [];
	const existingIds = new Set(existing.map((d) => d['unique-id']));
	const additions = sidecar.decorators.filter((d) => !existingIds.has(d['unique-id']));
	return { ...arch, decorators: [...existing, ...additions] };
}

/**
 * Split the architecture's decorators into two buckets:
 *
 *   - sidecar:  decorators with type in SIDECAR_DECORATOR_TYPES
 *   - inline:   all other decorators (e.g. aigf-governance)
 *
 * Used by the export pipeline to write a companion `.threats.calm.json`
 * file while keeping the architecture's `decorators[]` aligned to the
 * non-sidecar ones (which is what currently flows through `.calmstudio.json`
 * patterns).
 */
export function splitDecoratorsForExport(arch: CalmArchitecture): {
	inline: CalmDecorator[];
	sidecar: CalmDecorator[];
} {
	const inline: CalmDecorator[] = [];
	const sidecar: CalmDecorator[] = [];
	for (const d of arch.decorators ?? []) {
		if (SIDECAR_DECORATOR_TYPES.has(d.type)) sidecar.push(d);
		else inline.push(d);
	}
	return { inline, sidecar };
}

/**
 * Build the sidecar payload from an architecture. Returns null when there
 * are no sidecar-eligible decorators.
 */
export function buildThreatsSidecar(arch: CalmArchitecture): ThreatsSidecar | null {
	const { sidecar } = splitDecoratorsForExport(arch);
	if (sidecar.length === 0) return null;
	return { decorators: sidecar };
}
