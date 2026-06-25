// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decoratorMigration.test.ts — Unit tests for the pure embedded↔sidecar
 * decorator helpers.
 */

import { describe, it, expect } from 'vitest';
import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';
import { liftEmbeddedDecorators, mergeDecoratorLists } from '$lib/io/decoratorMigration';

const dec = (over: Partial<CalmDecorator> = {}): CalmDecorator => ({
	'unique-id': 'd1',
	type: 'gemara-link',
	target: ['a.json'],
	'applies-to': ['n1'],
	data: { k: 1 },
	...over,
});

const archWith = (decorators?: CalmDecorator[]): CalmArchitecture =>
	({ nodes: [], relationships: [], ...(decorators ? { decorators } : {}) }) as CalmArchitecture;

describe('liftEmbeddedDecorators', () => {
	it('returns an empty array and an unchanged doc when there are none', () => {
		const { arch, decorators } = liftEmbeddedDecorators(archWith());
		expect(decorators).toEqual([]);
		expect(arch).not.toHaveProperty('decorators');
	});

	it('extracts embedded decorators and strips them from the doc', () => {
		const { arch, decorators } = liftEmbeddedDecorators(archWith([dec()]));
		expect(decorators).toHaveLength(1);
		expect(arch).not.toHaveProperty('decorators');
		expect(arch.nodes).toEqual([]);
	});
});

describe('mergeDecoratorLists', () => {
	it('appends decorators with new unique-ids', () => {
		const out = mergeDecoratorLists([dec()], [dec({ 'unique-id': 'd2' })]);
		expect(out.map((d) => d['unique-id']).sort()).toEqual(['d1', 'd2']);
	});

	it('unions applies-to for a matching unique-id and lets incoming data win', () => {
		const existing = [dec({ 'applies-to': ['n1'], data: { v: 'old' } })];
		const incoming = [dec({ 'applies-to': ['n2'], data: { v: 'new' } })];
		const out = mergeDecoratorLists(existing, incoming);
		expect(out).toHaveLength(1);
		expect(out[0]['applies-to'].sort()).toEqual(['n1', 'n2']);
		expect(out[0].data).toEqual({ v: 'new' });
	});

	it('does not mutate the input lists', () => {
		const existing = [dec()];
		const incoming = [dec({ 'applies-to': ['n2'] })];
		mergeDecoratorLists(existing, incoming);
		expect(existing[0]['applies-to']).toEqual(['n1']);
	});

	it('preserves the order of existing ids (replace in place, not move-to-end)', () => {
		const existing = [dec({ 'unique-id': 'a' }), dec({ 'unique-id': 'b' }), dec({ 'unique-id': 'c' })];
		// merge an update to 'b' plus a new 'd'
		const out = mergeDecoratorLists(existing, [dec({ 'unique-id': 'b', 'applies-to': ['n2'] }), dec({ 'unique-id': 'd' })]);
		expect(out.map((d) => d['unique-id'])).toEqual(['a', 'b', 'c', 'd']);
	});
});
