// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import {
	registerTemplate,
	loadTemplate,
	getTemplatesByCategory,
	getAllCategories,
	getAllTemplates,
	initAllTemplates,
	type CalmTemplate,
} from '$lib/templates/registry';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTemplate(id: string, category: string): CalmTemplate {
	return {
		nodes: [
			{
				'unique-id': `${id}-svc`,
				'node-type': 'service',
				name: `${id} Service`,
			},
		],
		relationships: [],
		_template: {
			id,
			name: `Template ${id}`,
			description: `A test template: ${id}`,
			category,
			tags: ['test'],
			version: '1.0',
			author: 'test',
		},
	};
}

// ─── registerTemplate ─────────────────────────────────────────────────────────

describe('registerTemplate', () => {
	it('registers a template in the registry', () => {
		const tmpl = makeTemplate('test-reg-1', 'Test');
		registerTemplate(tmpl);
		const all = getAllTemplates();
		const found = all.find((t) => t._template.id === 'test-reg-1');
		expect(found).toBeDefined();
	});

	it('overwrites on duplicate ID registration', () => {
		const tmpl1 = makeTemplate('test-dup', 'Category A');
		const tmpl2 = makeTemplate('test-dup', 'Category B');
		registerTemplate(tmpl1);
		registerTemplate(tmpl2);
		const all = getAllTemplates();
		const matches = all.filter((t) => t._template.id === 'test-dup');
		expect(matches).toHaveLength(1);
		expect(matches[0]._template.category).toBe('Category B');
	});
});

// ─── loadTemplate ─────────────────────────────────────────────────────────────

describe('loadTemplate', () => {
	beforeEach(() => {
		registerTemplate(makeTemplate('test-load', 'Load Tests'));
	});

	it('returns a CalmArchitecture for a known template ID', () => {
		const arch = loadTemplate('test-load');
		expect(arch).toBeDefined();
		expect(arch.nodes).toHaveLength(1);
	});

	it('strips the _template metadata field from the returned arch', () => {
		const arch = loadTemplate('test-load');
		expect(arch).not.toHaveProperty('_template');
	});

	it('preserves CALM nodes in the loaded arch', () => {
		const arch = loadTemplate('test-load');
		expect(arch.nodes[0]['unique-id']).toBe('test-load-svc');
	});

	it('preserves CALM relationships in the loaded arch', () => {
		const arch = loadTemplate('test-load');
		expect(arch.relationships).toHaveLength(0);
	});

	it('throws an error for unknown template ID', () => {
		expect(() => loadTemplate('nonexistent-id-xyz')).toThrow();
	});

	it('error message includes the missing template ID', () => {
		expect(() => loadTemplate('nonexistent-id-xyz')).toThrowError(/nonexistent-id-xyz/);
	});
});

// ─── getTemplatesByCategory ───────────────────────────────────────────────────

describe('getTemplatesByCategory', () => {
	beforeEach(() => {
		registerTemplate(makeTemplate('cat-test-a1', 'Finance'));
		registerTemplate(makeTemplate('cat-test-a2', 'Finance'));
		registerTemplate(makeTemplate('cat-test-b1', 'Platform'));
	});

	it('returns templates matching the given category', () => {
		const result = getTemplatesByCategory('Finance');
		const ids = result.map((t) => t._template.id);
		expect(ids).toContain('cat-test-a1');
		expect(ids).toContain('cat-test-a2');
	});

	it('does not return templates from other categories', () => {
		const result = getTemplatesByCategory('Finance');
		const ids = result.map((t) => t._template.id);
		expect(ids).not.toContain('cat-test-b1');
	});

	it('is case-insensitive for category matching', () => {
		const lower = getTemplatesByCategory('finance');
		const upper = getTemplatesByCategory('FINANCE');
		expect(lower.length).toBe(upper.length);
	});

	it('returns empty array for unknown category', () => {
		const result = getTemplatesByCategory('NonExistentCategory-xyz');
		expect(result).toHaveLength(0);
	});
});

// ─── getAllCategories ─────────────────────────────────────────────────────────

describe('getAllCategories', () => {
	beforeEach(() => {
		registerTemplate(makeTemplate('cat-unique-a', 'Banking'));
		registerTemplate(makeTemplate('cat-unique-b', 'Insurance'));
		registerTemplate(makeTemplate('cat-unique-c', 'Banking')); // duplicate category
	});

	it('returns an array of strings', () => {
		const cats = getAllCategories();
		expect(Array.isArray(cats)).toBe(true);
	});

	it('deduplicates categories', () => {
		const cats = getAllCategories();
		const bankingCount = cats.filter((c) => c === 'Banking').length;
		expect(bankingCount).toBe(1);
	});

	it('includes all registered categories', () => {
		const cats = getAllCategories();
		expect(cats).toContain('Banking');
		expect(cats).toContain('Insurance');
	});

	it('returns categories in sorted order', () => {
		const cats = getAllCategories();
		const sorted = [...cats].sort();
		expect(cats).toEqual(sorted);
	});
});

// ─── getAllTemplates ──────────────────────────────────────────────────────────

describe('getAllTemplates', () => {
	it('returns an array', () => {
		expect(Array.isArray(getAllTemplates())).toBe(true);
	});

	it('includes registered templates', () => {
		registerTemplate(makeTemplate('get-all-test', 'General'));
		const all = getAllTemplates();
		expect(all.some((t) => t._template.id === 'get-all-test')).toBe(true);
	});
});

// ─── initAllTemplates ─────────────────────────────────────────────────────────

describe('initAllTemplates', () => {
	it('registers all 6 FluxNova templates', () => {
		initAllTemplates();
		const all = getAllTemplates();
		// After init, there should be at least 6 FluxNova templates
		const fluxnovaTemplates = all.filter((t) => t._template.id.startsWith('fluxnova'));
		expect(fluxnovaTemplates.length).toBeGreaterThanOrEqual(6);
	});

	it('each registered FluxNova template has required metadata fields', () => {
		initAllTemplates();
		const all = getAllTemplates();
		const fluxnovaTemplates = all.filter((t) => t._template.id.startsWith('fluxnova'));
		for (const tmpl of fluxnovaTemplates) {
			expect(tmpl._template.id).toBeTruthy();
			expect(tmpl._template.name).toBeTruthy();
			expect(tmpl._template.category).toBeTruthy();
		}
	});

	it('loadTemplate works for fluxnova-platform after initAllTemplates', () => {
		initAllTemplates();
		const arch = loadTemplate('fluxnova-platform') as CalmArchitecture & { _template?: unknown };
		expect(arch).toBeDefined();
		expect(arch.nodes.length).toBeGreaterThan(0);
		expect(arch).not.toHaveProperty('_template');
	});

	it('getTemplatesByCategory returns FluxNova templates in their category', () => {
		initAllTemplates();
		const all = getAllTemplates();
		const fluxnovaTemplate = all.find((t) => t._template.id.startsWith('fluxnova'));
		if (fluxnovaTemplate) {
			const category = fluxnovaTemplate._template.category;
			const byCategory = getTemplatesByCategory(category);
			expect(byCategory.length).toBeGreaterThan(0);
		}
	});

	it('registers all 4 OpenGRIS templates', () => {
		initAllTemplates();
		const opengrisTemplates = getAllTemplates().filter((t) => t._template.category === 'opengris');
		expect(opengrisTemplates).toHaveLength(4);
	});

	it('registers at least 10 templates total (6 FluxNova + 4 OpenGRIS)', () => {
		initAllTemplates();
		expect(getAllTemplates().length).toBeGreaterThanOrEqual(10);
	});

	it('getTemplatesByCategory returns OpenGRIS templates', () => {
		initAllTemplates();
		const byCategory = getTemplatesByCategory('opengris');
		expect(byCategory).toHaveLength(4);
		const ids = byCategory.map((t) => t._template.id);
		expect(ids).toContain('opengris-local-dev');
		expect(ids).toContain('opengris-market-risk');
		expect(ids).toContain('opengris-scientific-research');
		expect(ids).toContain('opengris-multi-cloud');
	});

	it('loadTemplate works for opengris-local-dev after initAllTemplates', () => {
		initAllTemplates();
		const arch = loadTemplate('opengris-local-dev') as CalmArchitecture & { _template?: unknown };
		expect(arch).toBeDefined();
		expect(arch.nodes.length).toBeGreaterThan(0);
		expect(arch).not.toHaveProperty('_template');
	});
});
