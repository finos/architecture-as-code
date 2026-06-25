// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * sidecar.test.ts — Unit tests for the decorator-sidecar helpers in sidecar.ts.
 * (Pack-sidecar helpers are exercised via export.test.ts.)
 */

import { describe, it, expect } from 'vitest';
import type { CalmDecorator } from '@calmstudio/calm-core';
import {
	decoratorSidecarNameFor,
	stampDecoratorTarget,
	buildDecoratorSidecarData,
} from '$lib/io/sidecar';

const dec = (over: Partial<CalmDecorator> = {}): CalmDecorator => ({
	'unique-id': 'd1',
	type: 'gemara-link',
	target: [],
	'applies-to': ['api-service'],
	data: { k: 1 },
	...over,
});

describe('decoratorSidecarNameFor', () => {
	it('replaces a trailing .json with .decorators.json', () => {
		expect(decoratorSidecarNameFor('architecture.json')).toBe('architecture.decorators.json');
		expect(decoratorSidecarNameFor('payments.arch.json')).toBe('payments.arch.decorators.json');
	});

	it('appends .decorators.json when there is no .json extension', () => {
		expect(decoratorSidecarNameFor('payments')).toBe('payments.decorators.json');
	});
});

describe('stampDecoratorTarget', () => {
	it('sets the arch filename as the sole target when empty', () => {
		expect(stampDecoratorTarget(dec({ target: [] }), 'a.json').target).toEqual(['a.json']);
	});

	it('drops the generic architecture.json placeholder', () => {
		expect(stampDecoratorTarget(dec({ target: ['architecture.json'] }), 'a.json').target).toEqual(['a.json']);
	});

	it('does not duplicate the arch filename if already present', () => {
		expect(stampDecoratorTarget(dec({ target: ['a.json'] }), 'a.json').target).toEqual(['a.json']);
	});

	it('preserves other explicit targets after the arch filename', () => {
		expect(stampDecoratorTarget(dec({ target: ['b.json'] }), 'a.json').target).toEqual(['a.json', 'b.json']);
	});

	it('does not mutate the input decorator', () => {
		const input = dec({ target: ['architecture.json'] });
		stampDecoratorTarget(input, 'a.json');
		expect(input.target).toEqual(['architecture.json']);
	});
});

describe('buildDecoratorSidecarData', () => {
	it('wraps decorators in a { decorators } container with stamped targets', () => {
		const out = buildDecoratorSidecarData([dec(), dec({ 'unique-id': 'd2', target: ['x.json'] })], 'a.json');
		expect(out.decorators).toHaveLength(2);
		expect(out.decorators[0].target).toEqual(['a.json']);
		expect(out.decorators[1].target).toEqual(['a.json', 'x.json']);
	});
});
