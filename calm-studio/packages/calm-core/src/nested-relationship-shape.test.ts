// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Drives #2550 — CalmRelationship must be CALM 1.2 nested form, not flat.
 *
 * RED tests for the refactor: every assertion here demonstrates a current
 * non-compliance with the FINOS CALM 1.2 meta-schema. They MUST fail before
 * the refactor and pass after.
 */

import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCalmArchitecture } from './validation.js';
import type { CalmArchitecture, CalmRelationship } from './types.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const loadSchema = (name: string) =>
	JSON.parse(readFileSync(resolve(here, 'schemas', name), 'utf-8'));

function buildAjv(): Ajv2020 {
	const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
	addFormats.default(ajv);
	for (const f of [
		'calm.json',
		'core.json',
		'control.json',
		'control-requirement.json',
		'interface.json',
		'flow.json',
		'evidence.json',
		'units.json',
	]) {
		ajv.addSchema(loadSchema(f));
	}
	return ajv;
}

describe('CalmRelationship — CALM 1.2 nested form (#2550)', () => {
	it('TypeScript: CalmRelationship.relationship-type must be an object, not a string union', () => {
		// A nested-form relationship must satisfy the TypeScript type. This is a
		// compile-time assertion — if `CalmRelationship['relationship-type']` is still
		// the flat string union, this object literal will fail typecheck.
		const rel: CalmRelationship = {
			'unique-id': 'r1',
			'relationship-type': {
				connects: {
					source: { node: 'a' },
					destination: { node: 'b' },
				},
			},
		};
		expect(rel['relationship-type']).toBeTypeOf('object');
		expect(rel['relationship-type']).not.toBeTypeOf('string');
	});

	it('TypeScript: composed-of variant accepts container + nodes', () => {
		const rel: CalmRelationship = {
			'unique-id': 'r-co',
			'relationship-type': {
				'composed-of': {
					container: 'system-a',
					nodes: ['child-1', 'child-2'],
				},
			},
		};
		const rt = rel['relationship-type'];
		if (!('composed-of' in rt)) throw new Error('expected composed-of variant');
		expect(rt['composed-of'].container).toBe('system-a');
		expect(rt['composed-of'].nodes).toEqual(['child-1', 'child-2']);
	});

	it('TypeScript: interacts variant accepts actor + nodes', () => {
		const rel: CalmRelationship = {
			'unique-id': 'r-int',
			'relationship-type': {
				interacts: {
					actor: 'user',
					nodes: ['application'],
				},
			},
		};
		const rt = rel['relationship-type'];
		if (!('interacts' in rt)) throw new Error('expected interacts variant');
		expect(rt.interacts.actor).toBe('user');
	});

	it('TypeScript: deployed-in variant accepts container + nodes', () => {
		const rel: CalmRelationship = {
			'unique-id': 'r-dep',
			'relationship-type': {
				'deployed-in': {
					container: 'k8s-cluster',
					nodes: ['pod-1'],
				},
			},
		};
		const rt = rel['relationship-type'];
		if (!('deployed-in' in rt)) throw new Error('expected deployed-in variant');
		expect(rt['deployed-in'].container).toBe('k8s-cluster');
	});

	it('validateCalmArchitecture accepts nested CALM 1.2 form (no errors)', () => {
		const arch: CalmArchitecture = {
			nodes: [
				{
					'unique-id': 'a',
					'node-type': 'service',
					name: 'A',
					description: 'A node',
				},
				{
					'unique-id': 'b',
					'node-type': 'service',
					name: 'B',
					description: 'B node',
				},
			],
			relationships: [
				{
					'unique-id': 'a-to-b',
					'relationship-type': {
						connects: {
							source: { node: 'a' },
							destination: { node: 'b' },
						},
					},
				},
			],
		};
		const issues = validateCalmArchitecture(arch);
		const errors = issues.filter((i) => i.severity === 'error');
		expect(errors).toEqual([]);
	});

	it('validateCalmArchitecture rejects flat (legacy) form with at least one error', () => {
		// Flat form is the bug. After the refactor, the validator must reject it.
		// Cast through `unknown` because the new type must NOT accept this shape.
		const arch = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: '' },
			],
			relationships: [
				{
					'unique-id': 'a-to-b',
					'relationship-type': 'connects',
					source: 'a',
					destination: 'b',
				},
			],
		} as unknown as CalmArchitecture;
		const issues = validateCalmArchitecture(arch);
		const errors = issues.filter((i) => i.severity === 'error');
		expect(errors.length).toBeGreaterThan(0);
	});

	it('ajv 2020: nested-form arch validates against vendored calm.json meta-schema', () => {
		const ajv = buildAjv();
		const validate = ajv.getSchema('https://calm.finos.org/release/1.2/meta/calm.json');
		expect(validate).toBeDefined();
		const arch = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' },
				{ 'unique-id': 'c', 'node-type': 'system', name: 'C', description: 'C' },
			],
			relationships: [
				{
					'unique-id': 'a-to-b',
					'relationship-type': {
						connects: {
							source: { node: 'a' },
							destination: { node: 'b' },
						},
					},
				},
				{
					'unique-id': 'c-composed-of-a-b',
					'relationship-type': {
						'composed-of': {
							container: 'c',
							nodes: ['a', 'b'],
						},
					},
				},
			],
		};
		const ok = validate!(arch);
		if (!ok) {
			console.log('ajv errors:', JSON.stringify(validate!.errors, null, 2));
		}
		expect(ok).toBe(true);
	});

	it('ajv 2020: flat-form arch FAILS the vendored calm.json meta-schema', () => {
		const ajv = buildAjv();
		const validate = ajv.getSchema('https://calm.finos.org/release/1.2/meta/calm.json');
		const arch = {
			nodes: [
				{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'A' },
				{ 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'B' },
			],
			relationships: [
				{
					'unique-id': 'a-to-b',
					'relationship-type': 'connects',
					source: 'a',
					destination: 'b',
				},
			],
		};
		const ok = validate!(arch);
		expect(ok).toBe(false);
	});
});
