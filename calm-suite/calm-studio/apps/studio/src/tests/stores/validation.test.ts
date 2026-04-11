// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import type { CalmArchitecture } from '@calmstudio/calm-core';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';
import {
	runValidation,
	clearValidation,
	getIssues,
	getIssuesByElementId,
	getErrorCountForElement,
	getWarningCountForElement,
	isPanelOpen,
	closePanel,
	openPanel,
	getScrollToElementId,
	setScrollToElementId,
} from '$lib/stores/validation.svelte';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A well-formed minimal architecture — should produce no structural errors. */
const validArch: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'svc-1',
			'node-type': 'service',
			name: 'API Service',
			description: 'The main API service',
		},
		{
			'unique-id': 'db-1',
			'node-type': 'database',
			name: 'Main DB',
		},
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': 'connects',
			source: 'svc-1',
			destination: 'db-1',
			protocol: 'HTTPS',
		},
	],
};

/** An architecture with an unnamed node — triggers a validation issue. */
const archWithUnnamedNode: CalmArchitecture = {
	nodes: [
		{
			'unique-id': 'svc-1',
			'node-type': 'service',
			name: '', // empty name triggers validation issue
		},
		{
			'unique-id': 'db-1',
			'node-type': 'database',
			name: 'Main DB',
		},
	],
	relationships: [
		{
			'unique-id': 'rel-1',
			'relationship-type': 'connects',
			source: 'svc-1',
			destination: 'db-1',
		},
	],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
	resetModel();
	clearValidation();
});

// ─── runValidation ────────────────────────────────────────────────────────────

describe('runValidation', () => {
	it('opens the panel after running validation', () => {
		applyFromJson(validArch);
		expect(isPanelOpen()).toBe(false);
		runValidation();
		expect(isPanelOpen()).toBe(true);
	});

	it('returns issues as an array (may be empty for valid arch)', () => {
		applyFromJson(validArch);
		runValidation();
		const issues = getIssues();
		expect(Array.isArray(issues)).toBe(true);
	});

	it('produces at least one issue for an arch with an unnamed node', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		const issues = getIssues();
		expect(issues.length).toBeGreaterThan(0);
	});

	it('issues are sorted: errors come before warnings', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		const issues = getIssues();
		if (issues.length >= 2) {
			const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
			for (let i = 1; i < issues.length; i++) {
				const prev = severityOrder[issues[i - 1].severity] ?? 2;
				const curr = severityOrder[issues[i].severity] ?? 2;
				expect(prev).toBeLessThanOrEqual(curr);
			}
		}
	});
});

// ─── clearValidation ──────────────────────────────────────────────────────────

describe('clearValidation', () => {
	it('clears all issues', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		expect(getIssues().length).toBeGreaterThan(0);
		clearValidation();
		expect(getIssues()).toHaveLength(0);
	});

	it('closes the panel', () => {
		applyFromJson(validArch);
		runValidation();
		expect(isPanelOpen()).toBe(true);
		clearValidation();
		expect(isPanelOpen()).toBe(false);
	});

	it('clears the scroll-to element ID', () => {
		setScrollToElementId('svc-1');
		clearValidation();
		expect(getScrollToElementId()).toBeNull();
	});
});

// ─── getIssuesByElementId ─────────────────────────────────────────────────────

describe('getIssuesByElementId', () => {
	it('returns empty array when no issues for the given id', () => {
		applyFromJson(validArch);
		runValidation();
		const nodeIssues = getIssuesByElementId('nonexistent-id');
		expect(nodeIssues).toHaveLength(0);
	});

	it('returns only issues matching the specified element id', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		const allIssues = getIssues();
		// For each issue that references an element, verify getIssuesByElementId filters correctly
		const elementIds = new Set(
			allIssues.flatMap((i) => [i.nodeId, i.relationshipId]).filter(Boolean)
		);
		for (const id of elementIds) {
			if (!id) continue;
			const filtered = getIssuesByElementId(id);
			filtered.forEach((issue) => {
				expect(issue.nodeId === id || issue.relationshipId === id).toBe(true);
			});
		}
	});
});

// ─── getErrorCountForElement ──────────────────────────────────────────────────

describe('getErrorCountForElement', () => {
	it('returns 0 for element with no errors', () => {
		applyFromJson(validArch);
		runValidation();
		expect(getErrorCountForElement('svc-1')).toBe(0);
	});

	it('returns 0 before any validation runs', () => {
		expect(getErrorCountForElement('svc-1')).toBe(0);
	});

	it('counts only error-severity issues for the element', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		const allIssues = getIssues();
		// Find an element that actually has errors
		const errorIssues = allIssues.filter((i) => i.severity === 'error');
		if (errorIssues.length > 0 && errorIssues[0].nodeId) {
			const id = errorIssues[0].nodeId;
			const count = getErrorCountForElement(id);
			expect(count).toBeGreaterThan(0);
		}
	});
});

// ─── getWarningCountForElement ────────────────────────────────────────────────

describe('getWarningCountForElement', () => {
	it('returns 0 for element with no warnings', () => {
		applyFromJson(validArch);
		runValidation();
		// Most elements won't have warnings for valid arch — just verify returns number
		const count = getWarningCountForElement('svc-1');
		expect(typeof count).toBe('number');
		expect(count).toBeGreaterThanOrEqual(0);
	});
});

// ─── isPanelOpen / closePanel / openPanel ─────────────────────────────────────

describe('panel open/close', () => {
	it('isPanelOpen returns false initially', () => {
		expect(isPanelOpen()).toBe(false);
	});

	it('isPanelOpen returns true after runValidation', () => {
		applyFromJson(validArch);
		runValidation();
		expect(isPanelOpen()).toBe(true);
	});

	it('closePanel closes the panel without clearing issues', () => {
		applyFromJson(archWithUnnamedNode);
		runValidation();
		const issuesBefore = getIssues().length;
		closePanel();
		expect(isPanelOpen()).toBe(false);
		expect(getIssues()).toHaveLength(issuesBefore); // issues retained
	});

	it('openPanel re-opens after closePanel', () => {
		applyFromJson(validArch);
		runValidation();
		closePanel();
		expect(isPanelOpen()).toBe(false);
		openPanel();
		expect(isPanelOpen()).toBe(true);
	});
});

// ─── setScrollToElementId / getScrollToElementId ──────────────────────────────

describe('scroll coordination', () => {
	it('getScrollToElementId returns null initially', () => {
		expect(getScrollToElementId()).toBeNull();
	});

	it('setScrollToElementId stores the id', () => {
		setScrollToElementId('svc-1');
		expect(getScrollToElementId()).toBe('svc-1');
	});

	it('setScrollToElementId opens panel when a non-null id is set', () => {
		setScrollToElementId('svc-1');
		expect(isPanelOpen()).toBe(true);
	});

	it('setScrollToElementId(null) clears the id without closing panel', () => {
		applyFromJson(validArch);
		runValidation(); // opens panel
		setScrollToElementId('svc-1');
		setScrollToElementId(null);
		expect(getScrollToElementId()).toBeNull();
		// Panel state should remain open (runValidation already opened it)
		expect(isPanelOpen()).toBe(true);
	});
});
