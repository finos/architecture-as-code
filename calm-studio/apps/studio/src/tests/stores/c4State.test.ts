// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
	isC4Mode,
	getC4Level,
	getC4DrillStack,
	getCurrentDrillParentId,
	enterC4Mode,
	setC4Level,
	exitC4Mode,
	drillDown,
	drillUpTo,
	resetC4State,
} from '$lib/c4/c4State.svelte';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	resetC4State();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
	it('isC4Mode returns false initially', () => {
		expect(isC4Mode()).toBe(false);
	});

	it('getC4Level returns null initially', () => {
		expect(getC4Level()).toBeNull();
	});

	it('getC4DrillStack returns empty array initially', () => {
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('getCurrentDrillParentId returns null initially', () => {
		expect(getCurrentDrillParentId()).toBeNull();
	});
});

// ─── enterC4Mode ─────────────────────────────────────────────────────────────

describe('enterC4Mode', () => {
	it('sets isC4Mode to true', () => {
		enterC4Mode('context');
		expect(isC4Mode()).toBe(true);
	});

	it('sets the level to the provided C4Level', () => {
		enterC4Mode('context');
		expect(getC4Level()).toBe('context');
	});

	it('clears any existing drill stack on entry', () => {
		enterC4Mode('container');
		drillDown('sys-1', 'Payment System');
		drillDown('svc-1', 'API Service');
		expect(getC4DrillStack()).toHaveLength(2);

		// Entering C4 mode again should clear the stack
		enterC4Mode('context');
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('accepts container level', () => {
		enterC4Mode('container');
		expect(getC4Level()).toBe('container');
	});

	it('accepts component level', () => {
		enterC4Mode('component');
		expect(getC4Level()).toBe('component');
	});
});

// ─── setC4Level ───────────────────────────────────────────────────────────────

describe('setC4Level', () => {
	it('changes the level without requiring re-entry', () => {
		enterC4Mode('context');
		setC4Level('container');
		expect(getC4Level()).toBe('container');
		expect(isC4Mode()).toBe(true);
	});

	it('clears drill stack when level changes', () => {
		enterC4Mode('context');
		drillDown('sys-1', 'System A');
		setC4Level('container');
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('stays in C4 mode after level change', () => {
		enterC4Mode('context');
		setC4Level('component');
		expect(isC4Mode()).toBe(true);
	});
});

// ─── exitC4Mode ───────────────────────────────────────────────────────────────

describe('exitC4Mode', () => {
	it('sets isC4Mode to false', () => {
		enterC4Mode('context');
		exitC4Mode();
		expect(isC4Mode()).toBe(false);
	});

	it('sets level back to null', () => {
		enterC4Mode('container');
		exitC4Mode();
		expect(getC4Level()).toBeNull();
	});

	it('clears the drill stack', () => {
		enterC4Mode('container');
		drillDown('sys-1', 'System A');
		exitC4Mode();
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('getCurrentDrillParentId returns null after exit', () => {
		enterC4Mode('container');
		drillDown('sys-1', 'System A');
		exitC4Mode();
		expect(getCurrentDrillParentId()).toBeNull();
	});
});

// ─── drillDown ────────────────────────────────────────────────────────────────

describe('drillDown', () => {
	beforeEach(() => {
		enterC4Mode('container');
	});

	it('adds an entry to the drill stack', () => {
		drillDown('sys-1', 'Payment System');
		expect(getC4DrillStack()).toHaveLength(1);
	});

	it('stores the nodeId in the stack entry', () => {
		drillDown('sys-1', 'Payment System');
		expect(getC4DrillStack()[0].nodeId).toBe('sys-1');
	});

	it('stores the label in the stack entry', () => {
		drillDown('sys-1', 'Payment System');
		expect(getC4DrillStack()[0].label).toBe('Payment System');
	});

	it('getCurrentDrillParentId returns the last drilled nodeId', () => {
		drillDown('sys-1', 'Payment System');
		expect(getCurrentDrillParentId()).toBe('sys-1');
	});

	it('stacks multiple drill-downs in order', () => {
		drillDown('sys-1', 'Payment System');
		drillDown('svc-1', 'API Service');
		const stack = getC4DrillStack();
		expect(stack).toHaveLength(2);
		expect(stack[0].nodeId).toBe('sys-1');
		expect(stack[1].nodeId).toBe('svc-1');
	});

	it('getCurrentDrillParentId returns the deepest nodeId in a multi-level stack', () => {
		drillDown('sys-1', 'Payment System');
		drillDown('svc-1', 'API Service');
		expect(getCurrentDrillParentId()).toBe('svc-1');
	});
});

// ─── drillUpTo ────────────────────────────────────────────────────────────────

describe('drillUpTo', () => {
	beforeEach(() => {
		enterC4Mode('container');
		drillDown('sys-1', 'System A');
		drillDown('svc-1', 'Service B');
		drillDown('db-1', 'Database C');
		// Stack: [sys-1, svc-1, db-1]
	});

	it('drillUpTo(0) clears the stack entirely (return to root)', () => {
		drillUpTo(0);
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('drillUpTo(0) makes getCurrentDrillParentId return null', () => {
		drillUpTo(0);
		expect(getCurrentDrillParentId()).toBeNull();
	});

	it('drillUpTo(1) keeps only the first entry in the stack', () => {
		drillUpTo(1);
		const stack = getC4DrillStack();
		expect(stack).toHaveLength(1);
		expect(stack[0].nodeId).toBe('sys-1');
	});

	it('drillUpTo(2) keeps first two entries', () => {
		drillUpTo(2);
		const stack = getC4DrillStack();
		expect(stack).toHaveLength(2);
		expect(stack[0].nodeId).toBe('sys-1');
		expect(stack[1].nodeId).toBe('svc-1');
	});

	it('getCurrentDrillParentId after drillUpTo(1) returns the first entry nodeId', () => {
		drillUpTo(1);
		expect(getCurrentDrillParentId()).toBe('sys-1');
	});
});

// ─── resetC4State ─────────────────────────────────────────────────────────────

describe('resetC4State', () => {
	it('resets isC4Mode to false', () => {
		enterC4Mode('context');
		resetC4State();
		expect(isC4Mode()).toBe(false);
	});

	it('resets getC4Level to null', () => {
		enterC4Mode('component');
		resetC4State();
		expect(getC4Level()).toBeNull();
	});

	it('clears the drill stack', () => {
		enterC4Mode('container');
		drillDown('sys-1', 'System A');
		resetC4State();
		expect(getC4DrillStack()).toHaveLength(0);
	});

	it('getCurrentDrillParentId returns null after reset', () => {
		enterC4Mode('container');
		drillDown('sys-1', 'System A');
		resetC4State();
		expect(getCurrentDrillParentId()).toBeNull();
	});
});
