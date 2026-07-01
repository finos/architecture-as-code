// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { CalmControls } from '@calmstudio/calm-core';
import ControlsList from '$lib/properties/ControlsList.svelte';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const securityControl: CalmControls = {
	'security-domain': {
		description: 'LLM security domain control',
		requirements: [
			{ 'requirement-url': 'https://finos.org/aigf/controls/security-domain' },
		],
	},
};

const multipleControls: CalmControls = {
	'security-domain': {
		description: 'Security control',
		requirements: [],
	},
	'data-encryption': {
		description: 'Encrypt data at rest',
		requirements: [{ 'requirement-url': 'https://example.com/encryption' }],
	},
};

describe('ControlsList', () => {
	it('renders a collapsible Controls section toggle button', () => {
		const { getByRole } = render(ControlsList, {
			props: { controls: securityControl, onupdate: vi.fn() },
		});
		// The section toggle button contains "Controls" text
		const toggle = getByRole('button', { name: /controls/i });
		expect(toggle).toBeTruthy();
	});

	it('section toggle button has aria-expanded attribute (a11y)', () => {
		const { getByRole } = render(ControlsList, {
			props: { controls: securityControl, onupdate: vi.fn() },
		});
		const toggle = getByRole('button', { name: /controls/i });
		// aria-expanded starts as false (collapsed by default)
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows control count badge when controls are present', () => {
		const { getByText } = render(ControlsList, {
			props: { controls: securityControl, onupdate: vi.fn() },
		});
		// Badge shows count of 1 control
		expect(getByText('1')).toBeTruthy();
	});

	it('shows badge with count 2 for multiple controls', () => {
		const { getByText } = render(ControlsList, {
			props: { controls: multipleControls, onupdate: vi.fn() },
		});
		expect(getByText('2')).toBeTruthy();
	});

	it('does not show badge when controls object is empty', () => {
		const { queryByText } = render(ControlsList, {
			props: { controls: {}, onupdate: vi.fn() },
		});
		// No badge text for 0 controls
		expect(queryByText('0')).toBeNull();
	});

	it('expands section and shows control key after clicking toggle', async () => {
		const { getByRole, getByText } = render(ControlsList, {
			props: { controls: securityControl, onupdate: vi.fn() },
		});
		const toggle = getByRole('button', { name: /controls/i });
		await fireEvent.click(toggle);
		// After expansion, control key text is visible
		expect(getByText('security-domain')).toBeTruthy();
	});

	it('shows "No controls defined" empty hint when expanded with empty controls', async () => {
		const { getByRole, getByText } = render(ControlsList, {
			props: { controls: {}, onupdate: vi.fn() },
		});
		const toggle = getByRole('button', { name: /controls/i });
		await fireEvent.click(toggle);
		expect(getByText(/no controls defined/i)).toBeTruthy();
	});

	it('renders Add Control button when expanded and not readonly', async () => {
		const { getByRole } = render(ControlsList, {
			props: { controls: {}, onupdate: vi.fn(), readonly: false },
		});
		const toggle = getByRole('button', { name: /controls/i });
		await fireEvent.click(toggle);
		// "Add Control" button should appear in expanded view
		expect(getByRole('button', { name: /add control/i })).toBeTruthy();
	});

	it('does NOT render Add Control button when readonly=true', async () => {
		const { getByRole, queryByRole } = render(ControlsList, {
			props: { controls: {}, onupdate: vi.fn(), readonly: true },
		});
		const toggle = getByRole('button', { name: /controls/i });
		await fireEvent.click(toggle);
		// "Add Control" button must NOT be present in readonly mode
		expect(queryByRole('button', { name: /add control/i })).toBeNull();
	});
});
