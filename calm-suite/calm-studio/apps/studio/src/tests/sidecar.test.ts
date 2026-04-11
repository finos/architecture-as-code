// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { sidecarNameFor, detectPacksFromArch, buildSidecarData } from '$lib/io/sidecar.js';

describe('sidecarNameFor', () => {
	it('sidecarNameFor("architecture.json") returns "architecture.calmstudio.json"', () => {
		expect(sidecarNameFor('architecture.json')).toBe('architecture.calmstudio.json');
	});

	it('sidecarNameFor("my-diagram.calm.json") returns "my-diagram.calm.calmstudio.json"', () => {
		expect(sidecarNameFor('my-diagram.calm.json')).toBe('my-diagram.calm.calmstudio.json');
	});
});

describe('detectPacksFromArch', () => {
	it('detectPacksFromArch with aws:lambda and actor nodes returns ["aws"]', () => {
		const arch = { nodes: [{ 'node-type': 'aws:lambda' }, { 'node-type': 'actor' }] };
		expect(detectPacksFromArch(arch)).toEqual(['aws']);
	});

	it('detectPacksFromArch with only core types returns []', () => {
		const arch = { nodes: [{ 'node-type': 'actor' }] };
		expect(detectPacksFromArch(arch)).toEqual([]);
	});
});

describe('buildSidecarData', () => {
	it('builds sidecar data with correct version and packVersions', () => {
		const result = buildSidecarData(['aws', 'k8s']);
		expect(result.version).toBe('1.0');
		expect(result.packs).toEqual(['aws', 'k8s']);
		expect(result.packVersions).toEqual({ aws: '1.0.0', k8s: '1.0.0' });
	});

	it('builds sidecar data with empty pack list', () => {
		const result = buildSidecarData([]);
		expect(result.packs).toEqual([]);
		expect(result.packVersions).toEqual({});
	});
});
