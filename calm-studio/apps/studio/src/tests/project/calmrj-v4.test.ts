// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';
import {
	inferComponentIdFromPath,
	resolveExtractPath,
} from '$lib/project/naming';
import { applyExtractToParent, collectExtractSubgraph } from '$lib/project/extractSubgraph';
import { splitRelativePath } from '$lib/project/projectFs';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import type { CalmProjectConfig } from '$lib/project/types';

describe('project defaults', () => {
	it('creates a valid default .calmrj shape', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(isCalmProjectConfig(cfg)).toBe(true);
		expect(cfg.name).toBe('onebank');
		expect(cfg.naming.profile).toBe('cengineering-archimate');
		expect(cfg.neighbors?.searchRoots).toEqual([]);
	});

	it('rejects invalid config', () => {
		expect(isCalmProjectConfig({})).toBe(false);
		expect(isCalmProjectConfig(null)).toBe(false);
	});

	it('accepts optional templates.dir', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(
			isCalmProjectConfig({
				...cfg,
				templates: { dir: 'templates' },
			})
		).toBe(true);
		expect(
			isCalmProjectConfig({
				...cfg,
				templates: { dir: 1 },
			} as unknown)
		).toBe(false);
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

	it('respects project-root patterns from .calmrj (does not replace with bundled)', () => {
		const projectConfig: CalmProjectConfig = {
			...createDefaultProjectConfig('aac'),
			naming: {
				profile: 'cengineering-archimate',
				rootDirs: { 'application-component': 'components' },
				patterns: {
					'archimate:applicationService': {
						dir: 'components/{{componentId}}/appservices',
						file: '{{componentId}}.{{id}}.appserv.json',
					},
					service: {
						dir: 'components/{{componentId}}/appservices',
						file: '{{componentId}}.{{id}}.appserv.json',
					},
					'archimate:applicationComponent': {
						dir: 'components/{{id}}',
						file: '{{id}}.appcomp.json',
					},
					system: {
						dir: 'components/{{id}}',
						file: '{{id}}.appcomp.json',
					},
				},
			},
		};

		const service = resolveExtractPath(
			'archimate:applicationService',
			{ name: 'Test service' },
			projectConfig,
			'components/aac/aac.appcomp.json'
		);
		expect(service.folder).toBe('components/aac/appservices');
		expect(service.fileName).toBe('aac.test-service.appserv.json');

		const appcomp = resolveExtractPath(
			'system',
			{ name: 'Payment Gateway' },
			projectConfig,
			'landscapes/onebank.json'
		);
		expect(appcomp.folder).toBe('components/payment-gateway');
		expect(appcomp.fileName).toBe('payment-gateway.appcomp.json');
	});

	it('uses explicit componentId over path inference', () => {
		const projectConfig = createDefaultProjectConfig();
		projectConfig.naming.patterns = {
			service: {
				dir: 'components/{{componentId}}/appservices',
				file: '{{componentId}}.{{name}}.appserv.json',
			},
		};

		const r = resolveExtractPath(
			'service',
			{ name: 'Find User', componentId: 'bem' },
			projectConfig,
			'components/other/other.appcomp.json'
		);
		expect(r.folder).toBe('components/bem/appservices');
		expect(r.fileName).toBe('bem.find-user.appserv.json');
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

describe('inferComponentIdFromPath', () => {
	it('reads slug from *.appcomp.json filename', () => {
		expect(inferComponentIdFromPath('components/prk/prk.appcomp.json')).toBe('prk');
	});

	it('falls back to parent folder name', () => {
		expect(inferComponentIdFromPath('components/prk/overview.json')).toBe('prk');
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
