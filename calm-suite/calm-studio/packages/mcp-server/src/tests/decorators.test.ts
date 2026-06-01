// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	getDecorators,
	getDecoratorsForNodeTool,
	getThreatsForNodeTool,
	getControl,
	addThreatDecorator
} from '../tools/decorators.js';

let tmpDir: string;
let filePath: string;

const archWithThreats = {
	$schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
	nodes: [
		{ 'unique-id': 'gw', 'node-type': 'service', name: 'Gateway', description: 'gw' },
		{ 'unique-id': 'reg', 'node-type': 'service', name: 'Registry', description: 'reg' },
		{ 'unique-id': 'other', 'node-type': 'service', name: 'Other', description: 'o' }
	],
	relationships: [],
	decorators: [
		{
			'unique-id': 'tm-cc',
			type: 'control-catalog',
			target: ['arch.calm.json'],
			'applies-to': ['gw'],
			data: {
				controls: [
					{ id: 'C8', description: 'ABAC' },
					{ id: 'C9', description: 'WORM logs' }
				]
			}
		},
		{
			'unique-id': 'tm-agl',
			type: 'threat-model',
			target: ['arch.calm.json'],
			'applies-to': ['gw', 'reg'],
			data: {
				threats: [
					{
						id: 'T-AGL-01',
						name: 'Agent Registry Poisoning',
						description: 'attacker writes to registry',
						mitigations: 'ABAC. WORM logs.',
						controls: ['C8', 'C9'],
						'affected-nodes': ['reg']
					}
				]
			}
		}
	]
};

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'calm-decor-test-'));
	filePath = join(tmpDir, 'arch.calm.json');
	writeFileSync(filePath, JSON.stringify(archWithThreats, null, 2));
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe('get_decorators tool', () => {
	it('lists every decorator without filter', () => {
		const result = getDecorators({ file: filePath });
		expect(result.isError).toBe(false);
		expect(result.content[0]!.text).toContain('tm-cc');
		expect(result.content[0]!.text).toContain('tm-agl');
	});

	it('filters by type', () => {
		const result = getDecorators({ file: filePath, type: 'threat-model' });
		expect(result.content[0]!.text).toContain('tm-agl');
		expect(result.content[0]!.text).not.toContain('tm-cc');
	});

	it('returns friendly message when no matches', () => {
		const result = getDecorators({ file: filePath, type: 'deployment' });
		expect(result.content[0]!.text).toContain('No decorators of type "deployment"');
	});
});

describe('get_decorators_for_node tool', () => {
	it('returns decorators where node-id appears in applies-to', () => {
		const result = getDecoratorsForNodeTool({ file: filePath, nodeId: 'gw' });
		expect(result.content[0]!.text).toContain('tm-cc');
		expect(result.content[0]!.text).toContain('tm-agl');
	});

	it('returns decorators where node-id appears via threat affected-nodes', () => {
		const result = getDecoratorsForNodeTool({ file: filePath, nodeId: 'reg' });
		expect(result.content[0]!.text).toContain('tm-agl');
	});

	it('returns friendly message when no decorators reference the node', () => {
		const result = getDecoratorsForNodeTool({ file: filePath, nodeId: 'other' });
		expect(result.content[0]!.text).toContain('No decorators');
	});
});

describe('get_threats_for_node tool', () => {
	it('returns matching threats with mitigations + controls', () => {
		const result = getThreatsForNodeTool({ file: filePath, nodeId: 'reg' });
		const text = result.content[0]!.text;
		expect(text).toContain('T-AGL-01');
		expect(text).toContain('Agent Registry Poisoning');
		expect(text).toContain('ABAC');
		expect(text).toContain('C8');
	});

	it('returns no threats for a node not in any affected-nodes', () => {
		const result = getThreatsForNodeTool({ file: filePath, nodeId: 'other' });
		expect(result.content[0]!.text).toContain('No threats');
	});
});

describe('get_control tool', () => {
	it('looks up known control id', () => {
		const result = getControl({ file: filePath, controlId: 'C8' });
		expect(result.isError).toBe(false);
		expect(result.content[0]!.text).toContain('ABAC');
	});

	it('errors on unknown control id', () => {
		const result = getControl({ file: filePath, controlId: 'C99' });
		expect(result.isError).toBe(true);
		expect(result.content[0]!.text).toContain('C99');
	});
});

describe('add_threat_decorator tool', () => {
	it('appends decorator and writes to file', () => {
		const result = addThreatDecorator({
			file: filePath,
			decorator: {
				'unique-id': 'tm-new',
				type: 'threat-model',
				'applies-to': ['gw'],
				data: {
					threats: [
						{
							id: 'T-NEW-01',
							name: 'New Threat',
							description: 'desc',
							mitigations: 'mit',
							controls: ['C8'],
							'affected-nodes': ['gw']
						}
					]
				}
			}
		});
		expect(result.isError).toBe(false);
		const written = JSON.parse(readFileSync(filePath, 'utf-8'));
		expect(written.decorators).toHaveLength(3);
		expect(written.decorators[2]['unique-id']).toBe('tm-new');
	});

	it('rejects duplicate unique-id', () => {
		const result = addThreatDecorator({
			file: filePath,
			decorator: {
				'unique-id': 'tm-agl',
				type: 'threat-model',
				'applies-to': ['gw'],
				data: {
					threats: [{ id: 'T', name: 'n', description: 'd', mitigations: 'm', controls: [] }]
				}
			}
		});
		expect(result.isError).toBe(true);
		expect(result.content[0]!.text).toContain('already exists');
	});

	it('rejects dangling node references in applies-to', () => {
		const result = addThreatDecorator({
			file: filePath,
			decorator: {
				'unique-id': 'tm-bad',
				type: 'threat-model',
				'applies-to': ['ghost-node'],
				data: {
					threats: [{ id: 'T', name: 'n', description: 'd', mitigations: 'm', controls: [] }]
				}
			}
		});
		expect(result.isError).toBe(true);
		expect(result.content[0]!.text).toContain('ghost-node');
	});

	it('rejects dangling node references in threat affected-nodes', () => {
		const result = addThreatDecorator({
			file: filePath,
			decorator: {
				'unique-id': 'tm-bad2',
				type: 'threat-model',
				'applies-to': ['gw'],
				data: {
					threats: [
						{
							id: 'T',
							name: 'n',
							description: 'd',
							mitigations: 'm',
							controls: [],
							'affected-nodes': ['ghost-affected']
						}
					]
				}
			}
		});
		expect(result.isError).toBe(true);
		expect(result.content[0]!.text).toContain('ghost-affected');
	});
});
