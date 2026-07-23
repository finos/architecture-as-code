// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';
import { resolveExtractPath } from '$lib/project/naming';
import { applyExtractToParent, collectExtractSubgraph } from '$lib/project/extractSubgraph';
import { splitRelativePath } from '$lib/project/projectFs';
import type { CalmArchitecture } from '@calmstudio/calm-core';

describe('project defaults', () => {
	it('creates a valid default .calmrj shape', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(isCalmProjectConfig(cfg)).toBe(true);
		expect(cfg.name).toBe('onebank');
		expect(cfg.naming.profile).toBe('cengineering-archimate');
	});

	it('rejects invalid config', () => {
		expect(isCalmProjectConfig({})).toBe(false);
		expect(isCalmProjectConfig(null)).toBe(false);
	});
});

describe('resolveExtractPath', () => {
	it('uses element name and one subfolder under the current diagram', () => {
		const r = resolveExtractPath(
			'archimate:applicationService',
			{ name: 'Test Service' },
			createDefaultProjectConfig(),
			'application-components/bem/bem.appcomp.json'
		);
		expect(r.mapped).toBe(true);
		expect(r.folder).toBe('application-components/bem/appserv.test-service');
		expect(r.fileName).toBe('test-service.appserv.json');
		expect(r.relativePath).toBe(
			'application-components/bem/appserv.test-service/test-service.appserv.json'
		);
	});

	it('resolves appcomp under current diagram dir', () => {
		const r = resolveExtractPath(
			'system',
			{ name: 'Payment Gateway' },
			createDefaultProjectConfig(),
			'landscapes/onebank.json'
		);
		expect(r.folder).toBe('landscapes/appcomp.payment-gateway');
		expect(r.fileName).toBe('payment-gateway.appcomp.json');
	});

	it('ignores legacy absolute .calmrj patterns (regression: aac / Test service)', () => {
		// Patterns written before "subdir under current diagram" change.
		const legacyConfig = createDefaultProjectConfig('aac');
		legacyConfig.naming.patterns = {
			'archimate:applicationService': {
				dir: 'application-components/{{componentId}}/appserv.{{id}}',
				file: '{{componentId}}.{{id}}.appserv.json',
			},
			service: {
				dir: 'application-components/{{id}}',
				file: '{{id}}.{{id}}.appserv.json',
			},
		};

		const r = resolveExtractPath(
			'archimate:applicationService',
			{ name: 'Test service' },
			legacyConfig,
			'application-components/aac/aac.appcomp.json'
		);

		expect(r.folder).toBe('application-components/aac/appserv.test-service');
		expect(r.fileName).toBe('test-service.appserv.json');
		expect(r.folder).not.toContain('application-components/aac/application-components');
		expect(r.fileName).not.toBe('test-service.test-service.appserv.json');
	});

	it('takes leaf segment when legacy dir is resolved without profile fallback', () => {
		const custom = createDefaultProjectConfig();
		custom.naming.profile = 'custom';
		custom.naming.patterns = {
			service: {
				dir: 'application-components/foo/appserv.{{name}}',
				file: '{{name}}.{{name}}.appserv.json',
			},
		};

		const r = resolveExtractPath(
			'service',
			{ name: 'Test Service' },
			custom,
			'application-components/aac/aac.appcomp.json'
		);
		expect(r.folder).toBe('application-components/aac/appserv.test-service');
		expect(r.fileName).toBe('test-service.appserv.json');
	});

	it('returns empty path + warning for unmapped type', () => {
		const r = resolveExtractPath(
			'unknown:type',
			{ name: 'x' },
			createDefaultProjectConfig(),
			'a/b.json'
		);
		expect(r.mapped).toBe(false);
		expect(r.folder).toBe('');
		expect(r.fileName).toBe('');
		expect(r.warning).toContain('No naming pattern');
	});
});

describe('extractSubgraph', () => {
	const arch: CalmArchitecture = {
		nodes: [
			{
				'unique-id': 'parent',
				'node-type': 'system',
				name: 'Parent',
				description: 'p',
			},
			{
				'unique-id': 'child',
				'node-type': 'service',
				name: 'Child',
				description: 'c',
			},
			{
				'unique-id': 'peer',
				'node-type': 'service',
				name: 'Peer',
				description: 'x',
			},
		],
		relationships: [
			{
				'unique-id': 'comp',
				'relationship-type': {
					'composed-of': { container: 'parent', nodes: ['child'] },
				},
			},
			{
				'unique-id': 'ext',
				'relationship-type': {
					connects: {
						source: { node: 'parent' },
						destination: { node: 'peer' },
					},
				},
			},
		],
	};

	it('moves containment children and internal rels to child file', () => {
		const result = collectExtractSubgraph(arch, 'parent');
		expect([...result.extractIds].sort()).toEqual(['child', 'parent']);
		expect(result.internalRelationships.map((r) => r['unique-id'])).toEqual(['comp']);
		expect(result.boundaryRelationships.map((r) => r['unique-id'])).toEqual(['ext']);
		expect(result.childArchitecture.nodes.map((n) => n['unique-id']).sort()).toEqual([
			'child',
			'parent',
		]);
	});

	it('replaces root with stub keeping same unique-id', () => {
		const { parentArchitecture, childArchitecture } = applyExtractToParent(
			arch,
			'parent',
			'../application-components/parent/parent.appcomp.json'
		);
		expect(childArchitecture.nodes).toHaveLength(2);
		expect(parentArchitecture.nodes.map((n) => n['unique-id']).sort()).toEqual([
			'parent',
			'peer',
		]);
		const stub = parentArchitecture.nodes.find((n) => n['unique-id'] === 'parent');
		expect(stub?.details?.['detailed-architecture']).toBe(
			'../application-components/parent/parent.appcomp.json'
		);
		expect(parentArchitecture.relationships?.map((r) => r['unique-id'])).toEqual(['ext']);
	});
});

describe('splitRelativePath', () => {
	it('splits dir and file', () => {
		expect(splitRelativePath('a/b/c.json')).toEqual({ dir: 'a/b', name: 'c.json' });
		expect(splitRelativePath('c.json')).toEqual({ dir: '', name: 'c.json' });
	});
});
