// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, beforeEach } from 'vitest';
import {
	clearTemplateRegistry,
	getAllTemplates,
	initAllTemplates,
	loadTemplate,
	parseCalmTemplate,
	registerTemplate,
	resetToBundledTemplates,
	type CalmTemplate,
} from '$lib/templates/registry';

const sample: CalmTemplate = {
	nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'S', description: '' }],
	relationships: [],
	_template: {
		id: 'proj-sample',
		name: 'Project sample',
		description: '',
		category: 'team',
		tags: [],
		version: '1.0.0',
		author: 'test',
	},
};

const overwriteFluxnova: CalmTemplate = {
	nodes: [],
	relationships: [],
	_template: {
		id: 'fluxnova-platform',
		name: 'Overwritten platform',
		description: '',
		category: 'fluxnova',
		tags: [],
		version: '9.0.0',
		author: 'project',
	},
};

describe('parseCalmTemplate', () => {
	it('accepts _template id, name, category plus nodes/relationships', () => {
		expect(parseCalmTemplate(sample)).not.toBeNull();
		expect(parseCalmTemplate(sample)?._template.id).toBe('proj-sample');
	});

	it('rejects JSON without _template metadata', () => {
		expect(parseCalmTemplate({ nodes: [], relationships: [] })).toBeNull();
	});

	it('rejects missing id', () => {
		expect(
			parseCalmTemplate({
				nodes: [],
				relationships: [],
				_template: { name: 'x', category: 'y' },
			})
		).toBeNull();
	});
});

describe('project template merge', () => {
	beforeEach(() => {
		resetToBundledTemplates();
	});

	it('registers project templates alongside bundled ones', () => {
		const before = getAllTemplates().length;
		registerTemplate(sample);
		expect(getAllTemplates().length).toBe(before + 1);
		expect(getAllTemplates().some((t) => t._template.id === 'proj-sample')).toBe(true);
	});

	it('same id overwrites bundled template', () => {
		registerTemplate(overwriteFluxnova);
		const arch = loadTemplate('fluxnova-platform') as { nodes: unknown[] };
		expect(arch.nodes).toEqual([]);
		const meta = getAllTemplates().find((t) => t._template.id === 'fluxnova-platform');
		expect(meta?._template.name).toBe('Overwritten platform');
	});

	it('resetToBundledTemplates drops project-only ids', () => {
		registerTemplate(sample);
		resetToBundledTemplates();
		expect(getAllTemplates().some((t) => t._template.id === 'proj-sample')).toBe(false);
		expect(getAllTemplates().some((t) => t._template.id === 'fluxnova-platform')).toBe(true);
	});

	it('clearTemplateRegistry empties the map', () => {
		initAllTemplates();
		clearTemplateRegistry();
		expect(getAllTemplates()).toEqual([]);
	});
});
