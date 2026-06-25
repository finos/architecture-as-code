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
import { readDocumentName, writeDocumentName } from '$lib/io/documentName';

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
	const { _template: stripped, ...rest } = t;
	const arch = rest as CalmArchitecture;
	// Stamp the template's display name as the document name (unless the template
	// JSON already carries one), so a loaded template spawns in titled rather than
	// "Unsaved Document". importCalmFile reads this back via metadata.name.
	if (!readDocumentName(arch)) {
		arch.metadata = writeDocumentName(arch.metadata, stripped.name) as CalmArchitecture['metadata'];
	}
	return arch;
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
import multiAgentContext from '../reference/multi-agent-ref-arch/context.arch.json';

// The Multi-Agent Reference Architecture flagship template is the Tier-1 context
// document of the CALM document series in lib/reference/multi-agent-ref-arch/.
// It carries no _template block (it's a pure CALM doc); the template metadata is
// attached here so the reference series stays clean and CLI-valid.
const multiAgentRefArchTemplate = {
	_template: {
		id: 'multi-agent-ref-arch',
		name: 'Multi-Agent Reference Architecture',
		description:
			'AIGF-aligned multi-agent reference architecture — the 8-layer context view. Each layer links to a detailed, deployable elaboration (see lib/reference/multi-agent-ref-arch).',
		category: 'finos',
		tags: ['finos', 'ai', 'multi-agent', 'aigf', 'ccc', 'governance', 'reference'],
		version: '1.0.0',
		author: 'FINOS',
		sourceRef: 'https://github.com/finos/ai-governance-framework',
	},
	...multiAgentContext,
};

/**
 * Register all bundled templates (6 FluxNova + 4 OpenGRIS + the FINOS
 * Multi-Agent Reference Architecture — the canvas for AIGF + CCC governance).
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
	registerTemplate(multiAgentRefArchTemplate as unknown as CalmTemplate);
}
