// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
	isC4Mode,
	getC4Level,
	getC4Trail,
	getCurrentFrame,
	getActiveDocumentRef,
	enterC4,
	exitC4,
	drillIntoDocument,
	navigateUpTo,
	resetC4State,
} from '$lib/c4/c4State.svelte';

beforeEach(() => resetC4State());

describe('c4State — initial', () => {
	it('starts inactive with an empty trail', () => {
		expect(isC4Mode()).toBe(false);
		expect(getC4Level()).toBeNull();
		expect(getC4Trail()).toHaveLength(0);
		expect(getActiveDocumentRef()).toBeNull();
	});
});

describe('c4State — enter/exit', () => {
	it('enterC4 starts at the root (the editable document, ref = null)', () => {
		enterC4('My System', 'context');
		expect(isC4Mode()).toBe(true);
		expect(getC4Level()).toBe('context');
		expect(getC4Trail()).toEqual([{ ref: null, label: 'My System', level: 'context' }]);
		expect(getActiveDocumentRef()).toBeNull(); // editing the root document
	});
	it('exitC4 clears everything', () => {
		enterC4('X');
		drillIntoDocument('ref-a', 'A', 'container');
		exitC4();
		expect(isC4Mode()).toBe(false);
		expect(getC4Trail()).toHaveLength(0);
	});
});

describe('c4State — drilling documents', () => {
	beforeEach(() => enterC4('Root', 'context'));
	it('descends a level and becomes the active document', () => {
		expect(drillIntoDocument('ref-a', 'Agent Layer', 'container')).toBe('container');
		expect(getC4Level()).toBe('container');
		expect(getActiveDocumentRef()).toBe('ref-a');
		expect(getCurrentFrame()).toEqual({ ref: 'ref-a', label: 'Agent Layer', level: 'container' });
	});
	it('rejects a cycle (document already in the trail), without mutating', () => {
		drillIntoDocument('ref-a', 'A', 'container');
		expect(drillIntoDocument('ref-a', 'A', 'component')).toBeNull();
		expect(getC4Trail()).toHaveLength(2);
	});
	it('depth-derives the level when not declared (deeper stays component)', () => {
		expect(drillIntoDocument('a', 'A')).toBe('container');
		expect(drillIntoDocument('b', 'B')).toBe('component');
		expect(drillIntoDocument('c', 'C')).toBe('component');
	});
	it('a self-link (node linking to its own file) drills once, then is cycle-blocked', () => {
		// root frame ref is null, so the first self-drill is not yet in the trail
		expect(drillIntoDocument('A.json', 'A', 'container')).toBe('container');
		expect(drillIntoDocument('A.json', 'A')).toBeNull(); // now blocked
		expect(getC4Trail()).toHaveLength(2);
	});
});

describe('c4State — navigateUpTo', () => {
	beforeEach(() => {
		enterC4('Root', 'context');
		drillIntoDocument('ref-a', 'A', 'container');
		drillIntoDocument('ref-b', 'B', 'component');
	});
	it('pops to a frame and updates the active document', () => {
		expect(navigateUpTo(1)).toEqual({ ref: 'ref-a', label: 'A', level: 'container' });
		expect(getC4Trail()).toHaveLength(2);
		expect(getActiveDocumentRef()).toBe('ref-a');
	});
	it('navigateUpTo(0) returns to the root (editable) document', () => {
		expect(navigateUpTo(0)?.ref).toBeNull();
		expect(getActiveDocumentRef()).toBeNull();
		expect(getC4Level()).toBe('context');
	});
	it('clamps a too-large index; rejects a negative one (use exitC4)', () => {
		expect(navigateUpTo(999)?.label).toBe('B');
		expect(getC4Trail()).toHaveLength(3);
		expect(navigateUpTo(-1)).toBeNull();
		expect(getC4Trail()).toHaveLength(3);
	});
});

describe('c4State — resetC4State', () => {
	it('clears everything', () => {
		enterC4('X', 'context');
		drillIntoDocument('ref-a', 'A', 'container');
		resetC4State();
		expect(isC4Mode()).toBe(false);
		expect(getC4Trail()).toHaveLength(0);
	});
});
