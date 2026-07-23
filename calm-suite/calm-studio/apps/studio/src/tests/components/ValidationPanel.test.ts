// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { ValidationIssue } from '$lib/stores/validation.svelte';
import ValidationPanel from '$lib/validation/ValidationPanel.svelte';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const errorIssue: ValidationIssue = {
	severity: 'error',
	message: 'Node is missing required name field',
	nodeId: 'svc-1',
};

const warningIssue: ValidationIssue = {
	severity: 'warning',
	message: 'Node has no relationships (orphaned)',
	nodeId: 'db-1',
};

const infoIssue: ValidationIssue = {
	severity: 'info',
	message: 'Consider adding a description',
	nodeId: 'api-1',
};

describe('ValidationPanel', () => {
	it('renders the Problems panel header', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [] },
		});
		expect(getByText('Problems')).toBeTruthy();
	});

	it('renders dismiss/close button with accessible label (a11y)', () => {
		const { getByRole } = render(ValidationPanel, {
			props: { issues: [], ondismiss: vi.fn() },
		});
		const closeBtn = getByRole('button', { name: /dismiss validation panel/i });
		expect(closeBtn).toBeTruthy();
	});

	it('close button is focusable (not disabled)', () => {
		const { getByRole } = render(ValidationPanel, {
			props: { issues: [], ondismiss: vi.fn() },
		});
		const closeBtn = getByRole('button', { name: /dismiss validation panel/i }) as HTMLButtonElement;
		expect(closeBtn.disabled).toBe(false);
	});

	it('calls ondismiss when close button is clicked', async () => {
		const ondismiss = vi.fn();
		const { getByRole } = render(ValidationPanel, {
			props: { issues: [], ondismiss },
		});
		await fireEvent.click(getByRole('button', { name: /dismiss validation panel/i }));
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('shows empty state message when issues list is empty', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [] },
		});
		expect(getByText(/no validation issues/i)).toBeTruthy();
	});

	it('renders error issue message text', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [errorIssue] },
		});
		expect(getByText('Node is missing required name field')).toBeTruthy();
	});

	it('renders warning issue message text', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [warningIssue] },
		});
		expect(getByText('Node has no relationships (orphaned)')).toBeTruthy();
	});

	it('renders info issue message text', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [infoIssue] },
		});
		expect(getByText('Consider adding a description')).toBeTruthy();
	});

	it('renders element ID badges for issues that have nodeIds', () => {
		const { getAllByText } = render(ValidationPanel, {
			props: { issues: [errorIssue, warningIssue] },
		});
		// nodeId badge should appear for svc-1 and db-1
		expect(getAllByText('svc-1').length).toBeGreaterThan(0);
		expect(getAllByText('db-1').length).toBeGreaterThan(0);
	});

	it('shows summary text with error count when errors present', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [errorIssue] },
		});
		expect(getByText(/1 error/i)).toBeTruthy();
	});

	it('shows summary with both error and warning counts', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [errorIssue, warningIssue] },
		});
		// summaryText shows "1 error, 1 warning"
		expect(getByText(/1 error.*1 warning|1 warning.*1 error/i)).toBeTruthy();
	});

	it('renders multiple issues when provided', () => {
		const { getByText } = render(ValidationPanel, {
			props: { issues: [errorIssue, warningIssue, infoIssue] },
		});
		expect(getByText('Node is missing required name field')).toBeTruthy();
		expect(getByText('Node has no relationships (orphaned)')).toBeTruthy();
		expect(getByText('Consider adding a description')).toBeTruthy();
	});

	it('calls onnavigatetonode when issue row is clicked', async () => {
		const onnavigatetonode = vi.fn();
		const { getByText } = render(ValidationPanel, {
			props: { issues: [errorIssue], onnavigatetonode },
		});
		await fireEvent.click(getByText('Node is missing required name field'));
		expect(onnavigatetonode).toHaveBeenCalledWith('svc-1');
	});
});
