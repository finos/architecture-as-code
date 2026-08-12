// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import type { CalmArchitecture } from '../types.js';
import { validateCalmArchitecture } from '../validation.js';
import {
	normalizeArchimateElementId,
	isArchimateNode,
	runArchimateRules,
} from './rules.js';
import {
	validateArchimateNodeMetadata,
	validateArchimateRelationshipMetadata,
} from './schema.js';

const validators = {
	validateNodeMetadata: validateArchimateNodeMetadata,
	validateRelationshipMetadata: validateArchimateRelationshipMetadata,
};

function makeArchimateNode(
	id: string,
	nodeType: string,
	metadata?: Record<string, unknown>,
) {
	return {
		'unique-id': id,
		'node-type': nodeType,
		name: `Node ${id}`,
		description: `Description for ${id}`,
		...(metadata ? { metadata } : {}),
	};
}

function validArchimateMetadata(element = 'archimate:applicationService') {
	return {
		owner: 'platform-team',
		archimate: {
			layer: 'Application',
			element,
			viewpoint: 'ApplicationCooperation',
		},
	};
}

describe('normalizeArchimateElementId', () => {
	it('passes through canonical archimate:{camelCase} IDs', () => {
		expect(normalizeArchimateElementId('archimate:applicationService')).toBe(
			'archimate:applicationService',
		);
		expect(normalizeArchimateElementId('archimate:dataObject')).toBe('archimate:dataObject');
	});

	it('normalizes legacy PascalCase without prefix', () => {
		expect(normalizeArchimateElementId('ApplicationService')).toBe('archimate:applicationService');
		expect(normalizeArchimateElementId('DataObject')).toBe('archimate:dataObject');
	});

	it('normalizes prefixed PascalCase (Creditas style)', () => {
		expect(normalizeArchimateElementId('archimate:ApplicationComponent')).toBe(
			'archimate:applicationComponent',
		);
	});

	it('returns null for non-archimate values', () => {
		expect(normalizeArchimateElementId('service')).toBeNull();
	});
});

describe('isArchimateNode', () => {
	it('detects archimate-prefixed node types', () => {
		expect(isArchimateNode(makeArchimateNode('n1', 'archimate:dataObject'))).toBe(true);
		expect(isArchimateNode(makeArchimateNode('n2', 'service'))).toBe(false);
	});
});

describe('validateArchimateNodeMetadata schema', () => {
	it('rejects legacy PascalCase element without prefix', () => {
		expect(
			validateArchimateNodeMetadata({
				owner: 'team',
				archimate: {
					layer: 'Application',
					element: 'ApplicationService',
					viewpoint: 'ApplicationCooperation',
				},
			}),
		).toBe(false);
	});

	it('accepts archimate:{camelCase} element', () => {
		expect(
			validateArchimateNodeMetadata({
				owner: 'team',
				archimate: {
					layer: 'Application',
					element: 'archimate:applicationService',
					viewpoint: 'ApplicationCooperation',
				},
			}),
		).toBe(true);
	});
});

describe('validateArchimateRelationshipMetadata schema', () => {
	it('requires calm-core-variant for Serving and binds interacts', () => {
		expect(
			validateArchimateRelationshipMetadata({
				archimate: {
					relationship: 'Serving',
					'calm-core-variant': 'interacts',
				},
			}),
		).toBe(true);
	});

	it('rejects Serving with wrong calm-core-variant', () => {
		expect(
			validateArchimateRelationshipMetadata({
				archimate: {
					relationship: 'Serving',
					'calm-core-variant': 'connects',
				},
			}),
		).toBe(false);
	});

	it('rejects metadata without calm-core-variant', () => {
		expect(
			validateArchimateRelationshipMetadata({
				archimate: {
					relationship: 'Association',
				},
			}),
		).toBe(false);
	});
});

describe('runArchimateRules', () => {
	it('passes valid archimate node metadata', () => {
		const arch: CalmArchitecture = {
			nodes: [
				makeArchimateNode(
					'app-svc',
					'archimate:applicationService',
					validArchimateMetadata('archimate:applicationService'),
				),
			],
			relationships: [],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
	});

	it('errors when archimate node is missing metadata', () => {
		const arch: CalmArchitecture = {
			nodes: [makeArchimateNode('app-svc', 'archimate:applicationService')],
			relationships: [],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.some((i) => i.message.includes('[archimate-001]'))).toBe(true);
	});

	it('errors when metadata.archimate.element mismatches node-type', () => {
		const arch: CalmArchitecture = {
			nodes: [
				makeArchimateNode(
					'app-svc',
					'archimate:applicationService',
					validArchimateMetadata('archimate:applicationComponent'),
				),
			],
			relationships: [],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.some((i) => i.message.includes('[archimate-002]'))).toBe(true);
	});

	it('warns when relationship between archimate nodes lacks archimate metadata', () => {
		const arch: CalmArchitecture = {
			nodes: [
				makeArchimateNode(
					'node-a',
					'archimate:applicationService',
					validArchimateMetadata('archimate:applicationService'),
				),
				makeArchimateNode(
					'node-b',
					'archimate:applicationComponent',
					validArchimateMetadata('archimate:applicationComponent'),
				),
			],
			relationships: [
				{
					'unique-id': 'rel-1',
					'relationship-type': {
						connects: {
							source: { node: 'node-a' },
							destination: { node: 'node-b' },
						},
					},
				},
			],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.some((i) => i.message.includes('[archimate-003]'))).toBe(true);
	});

	it('passes relationship with valid archimate metadata (Serving + interacts)', () => {
		const arch: CalmArchitecture = {
			nodes: [
				makeArchimateNode(
					'node-a',
					'archimate:applicationService',
					validArchimateMetadata('archimate:applicationService'),
				),
				makeArchimateNode(
					'node-b',
					'archimate:applicationComponent',
					validArchimateMetadata('archimate:applicationComponent'),
				),
			],
			relationships: [
				{
					'unique-id': 'rel-1',
					metadata: {
						archimate: {
							relationship: 'Serving',
							'calm-core-variant': 'interacts',
						},
					},
					'relationship-type': {
						interacts: {
							actor: 'node-a',
							nodes: ['node-b'],
						},
					},
				},
			],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
		expect(issues.filter((i) => i.severity === 'warning')).toHaveLength(0);
	});

	it('errors when Serving uses connects instead of interacts (archimate-004)', () => {
		const arch: CalmArchitecture = {
			nodes: [
				makeArchimateNode(
					'node-a',
					'archimate:applicationService',
					validArchimateMetadata('archimate:applicationService'),
				),
				makeArchimateNode(
					'node-b',
					'archimate:applicationComponent',
					validArchimateMetadata('archimate:applicationComponent'),
				),
			],
			relationships: [
				{
					'unique-id': 'rel-1',
					metadata: {
						archimate: {
							relationship: 'Serving',
							'calm-core-variant': 'interacts',
						},
					},
					'relationship-type': {
						connects: {
							source: { node: 'node-a' },
							destination: { node: 'node-b' },
						},
					},
				},
			],
		};

		const issues = runArchimateRules(arch, validators);
		expect(issues.some((i) => i.message.includes('[archimate-004]'))).toBe(true);
	});
});

describe('validateCalmArchitecture archimate integration', () => {
	it('includes archimate issues in full validation pipeline', () => {
		const arch: CalmArchitecture = {
			nodes: [makeArchimateNode('app-svc', 'archimate:applicationService')],
			relationships: [],
		};

		const issues = validateCalmArchitecture(arch);
		expect(issues.some((i) => i.message.includes('[archimate-001]'))).toBe(true);
	});
});
