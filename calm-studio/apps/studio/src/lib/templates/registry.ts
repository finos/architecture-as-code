// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * registry.ts — Template registry for CalmStudio.
 *
 * Provides functions to register, look up, and list template architectures.
 * Templates are CalmArchitecture objects with an additional `_template` metadata block.
 * The `loadTemplate` function strips `_template` before returning, ensuring clean
 * CALM JSON when a template is applied to the canvas.
 *
 * Usage:
 *   initAllTemplates();   // Call once at module level in +page.svelte
 *   const arch = loadTemplate('fluxnova-platform');
 */

import type { CalmArchitecture } from '@calmstudio/calm-core';

// ─── Template metadata type ───────────────────────────────────────────────────

export interface CalmTemplateMeta {
	id: string;
	name: string;
	description: string;
	category: string;
	tags: string[];
	version: string;
	author: string;
	sourceRef?: string;
}

// ─── CalmTemplate extends CalmArchitecture with metadata ─────────────────────

export interface CalmTemplate extends CalmArchitecture {
	_template: CalmTemplateMeta;
}

// ─── Internal registry ───────────────────────────────────────────────────────

const templates = new Map<string, CalmTemplate>();

// ─── Public registry API ─────────────────────────────────────────────────────

/**
 * Register a template in the registry.
 * Keyed by `_template.id` — overwrites on duplicate ID.
 */
export function registerTemplate(t: CalmTemplate): void {
	templates.set(t._template.id, t);
}

/**
 * Load a template by ID, stripping the `_template` metadata block.
 * Returns a plain CalmArchitecture ready to apply to the canvas.
 *
 * @throws Error if no template with the given ID is registered.
 */
export function loadTemplate(id: string): CalmArchitecture {
	const t = templates.get(id);
	if (!t) {
		throw new Error(`[TemplateRegistry] No template registered with id: ${id}`);
	}
	// Spread then delete — returns clean CalmArchitecture without _template
	const { _template: _stripped, ...arch } = t;
	return arch as CalmArchitecture;
}

/**
 * Return all templates in the given category.
 * Category comparison is case-insensitive.
 */
export function getTemplatesByCategory(category: string): CalmTemplate[] {
	const lower = category.toLowerCase();
	return Array.from(templates.values()).filter(
		(t) => t._template.category.toLowerCase() === lower
	);
}

/**
 * Return a sorted, deduplicated list of all registered categories.
 */
export function getAllCategories(): string[] {
	const cats = new Set<string>();
	for (const t of templates.values()) {
		cats.add(t._template.category);
	}
	return Array.from(cats).sort();
}

/**
 * Return all registered templates.
 */
export function getAllTemplates(): CalmTemplate[] {
	return Array.from(templates.values());
}

/** Remove every registered template (bundled and project). */
export function clearTemplateRegistry(): void {
	templates.clear();
}

/** Restore the bundled FluxNova + OpenGRIS set (drops project-only ids). */
export function resetToBundledTemplates(): void {
	templates.clear();
	initAllTemplates();
}

/**
 * True when `value` is a project/bundled template JSON object.
 * Requires `_template.id`, `_template.name`, `_template.category`.
 */
export function parseCalmTemplate(value: unknown): CalmTemplate | null {
	if (!value || typeof value !== 'object') return null;
	const rec = value as Record<string, unknown>;
	const meta = rec['_template'];
	if (!meta || typeof meta !== 'object') return null;
	const m = meta as Record<string, unknown>;
	if (typeof m['id'] !== 'string' || m['id'].trim() === '') return null;
	if (typeof m['name'] !== 'string' || m['name'].trim() === '') return null;
	if (typeof m['category'] !== 'string' || m['category'].trim() === '') return null;
	if (!Array.isArray(rec['nodes']) || !Array.isArray(rec['relationships'])) return null;
	const tags = Array.isArray(m['tags'])
		? m['tags'].filter((t): t is string => typeof t === 'string')
		: [];
	return {
		...(rec as unknown as CalmArchitecture),
		_template: {
			id: m['id'].trim(),
			name: m['name'].trim(),
			description: typeof m['description'] === 'string' ? m['description'] : '',
			category: m['category'].trim(),
			tags,
			version: typeof m['version'] === 'string' ? m['version'] : '1.0.0',
			author: typeof m['author'] === 'string' ? m['author'] : '',
			sourceRef: typeof m['sourceRef'] === 'string' ? m['sourceRef'] : undefined,
		},
	};
}

// ─── Static imports for all 10 templates (6 FluxNova + 4 OpenGRIS) ───────────
// SvelteKit / Vite handles JSON imports natively in the app package.

import fluxnovaPlatform from './fluxnova-platform.json';
import fluxnovaKycOnboarding from './fluxnova-kyc-onboarding.json';
import fluxnovaFlashRisk from './fluxnova-flash-risk.json';
import fluxnovaSettlement from './fluxnova-settlement.json';
import fluxnovaAiAgent from './fluxnova-ai-agent.json';
import fluxnovaMicroservices from './fluxnova-microservices.json';
import opengrisLocalDev from './opengris-local-dev.json';
import opengrisMarketRisk from './opengris-market-risk.json';
import opengrisScientificResearch from './opengris-scientific-research.json';
import opengrisMultiCloud from './opengris-multi-cloud.json';

/**
 * Register all 10 templates (6 FluxNova + 4 OpenGRIS).
 * Call once at module level in +page.svelte (alongside initAllPacks).
 */
export function initAllTemplates(): void {
	registerTemplate(fluxnovaPlatform as CalmTemplate);
	registerTemplate(fluxnovaKycOnboarding as CalmTemplate);
	registerTemplate(fluxnovaFlashRisk as CalmTemplate);
	registerTemplate(fluxnovaSettlement as CalmTemplate);
	registerTemplate(fluxnovaAiAgent as CalmTemplate);
	registerTemplate(fluxnovaMicroservices as CalmTemplate);
	registerTemplate(opengrisLocalDev as CalmTemplate);
	registerTemplate(opengrisMarketRisk as CalmTemplate);
	registerTemplate(opengrisScientificResearch as CalmTemplate);
	registerTemplate(opengrisMultiCloud as CalmTemplate);
}
