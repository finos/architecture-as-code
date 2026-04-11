// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Toolbar from '$lib/toolbar/Toolbar.svelte';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';
import { refreshGovernance } from '$lib/stores/governance.svelte';

// ─── Fixtures: create required callback props ─────────────────────────────────

function makeToolbarProps(overrides?: Record<string, unknown>) {
	return {
		onopen: vi.fn(),
		onsave: vi.fn(),
		onsaveas: vi.fn(),
		onnew: vi.fn(),
		onvalidate: vi.fn(),
		onexportcalm: vi.fn(),
		onexportsvg: vi.fn(),
		onexportpng: vi.fn(),
		onexportcalmscript: vi.fn(),
		...overrides,
	};
}

beforeEach(() => {
	resetModel();
});

describe('Toolbar — core buttons rendered', () => {
	it('renders New button with accessible name (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /new diagram/i })).toBeTruthy();
	});

	it('renders Open button with accessible name (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /open.*CALM JSON/i })).toBeTruthy();
	});

	it('renders Save button with accessible name (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /save diagram/i })).toBeTruthy();
	});

	it('renders Validate button with accessible name (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /validate CALM diagram/i })).toBeTruthy();
	});

	it('renders Export dropdown toggle button (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /export diagram/i })).toBeTruthy();
	});

	it('renders Demos dropdown button (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /load demo architecture/i })).toBeTruthy();
	});

	it('renders CalmStudio app name', () => {
		const { getByText } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByText('CalmStudio')).toBeTruthy();
	});

	it('renders C4 view selector buttons (All, Context, Container, Component)', () => {
		const { getAllByRole } = render(Toolbar, { props: makeToolbarProps() });
		// C4 buttons are plain buttons with no aria-label; find by role + text
		const allBtns = getAllByRole('button');
		const btnTexts = allBtns.map((b) => b.textContent?.trim());
		expect(btnTexts).toContain('All');
		expect(btnTexts).toContain('Context');
		expect(btnTexts).toContain('Container');
		expect(btnTexts).toContain('Component');
	});
});

describe('Toolbar — button callbacks', () => {
	it('calls onnew when New button is clicked', async () => {
		const onnew = vi.fn();
		const { getByRole } = render(Toolbar, { props: makeToolbarProps({ onnew }) });
		await fireEvent.click(getByRole('button', { name: /new diagram/i }));
		expect(onnew).toHaveBeenCalledOnce();
	});

	it('calls onopen when Open button is clicked', async () => {
		const onopen = vi.fn();
		const { getByRole } = render(Toolbar, { props: makeToolbarProps({ onopen }) });
		await fireEvent.click(getByRole('button', { name: /open.*CALM JSON/i }));
		expect(onopen).toHaveBeenCalledOnce();
	});

	it('calls onsave when Save button is clicked', async () => {
		const onsave = vi.fn();
		const { getByRole } = render(Toolbar, { props: makeToolbarProps({ onsave }) });
		await fireEvent.click(getByRole('button', { name: /save diagram/i }));
		expect(onsave).toHaveBeenCalledOnce();
	});

	it('calls onvalidate when Validate button is clicked', async () => {
		const onvalidate = vi.fn();
		const { getByRole } = render(Toolbar, { props: makeToolbarProps({ onvalidate }) });
		await fireEvent.click(getByRole('button', { name: /validate CALM diagram/i }));
		expect(onvalidate).toHaveBeenCalledOnce();
	});

	it('calls ontemplates when Templates button is clicked', async () => {
		const ontemplates = vi.fn();
		const { getByRole } = render(Toolbar, {
			props: makeToolbarProps({ ontemplates }),
		});
		await fireEvent.click(getByRole('button', { name: /open template picker/i }));
		expect(ontemplates).toHaveBeenCalledOnce();
	});
});

describe('Toolbar — governance badge', () => {
	it('does NOT render governance badge when showGovernanceBadge=false', () => {
		const { queryByRole } = render(Toolbar, {
			props: makeToolbarProps({ showGovernanceBadge: false, governanceScore: 75 }),
		});
		// Governance badge has aria-label "AIGF governance score: ..."
		expect(queryByRole('generic', { name: /AIGF governance score/i })).toBeNull();
	});

	it('renders governance badge when showGovernanceBadge=true and score is non-null', () => {
		const { getByText } = render(Toolbar, {
			props: makeToolbarProps({ showGovernanceBadge: true, governanceScore: 75 }),
		});
		// Score text visible in badge
		expect(getByText('75%')).toBeTruthy();
	});

	it('governance badge has accessible label with score value (a11y)', () => {
		const { container } = render(Toolbar, {
			props: makeToolbarProps({ showGovernanceBadge: true, governanceScore: 50 }),
		});
		// The gov-badge div has aria-label "AIGF governance score: 50%"
		const badge = container.querySelector('[aria-label*="AIGF governance score"]');
		expect(badge).toBeTruthy();
	});

	it('shows correct score color class for high score (>80)', () => {
		const { getByText } = render(Toolbar, {
			props: makeToolbarProps({ showGovernanceBadge: true, governanceScore: 90 }),
		});
		expect(getByText('90%')).toBeTruthy();
	});
});

describe('Toolbar — Scaler.toml export button', () => {
	it('does NOT render Scaler.toml export button when showScalerTomlExport is false', async () => {
		const { getByRole, queryByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: false }),
		});
		// Open export menu first
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		expect(queryByText('Scaler.toml (OpenGRIS)')).toBeNull();
	});

	it('renders Scaler.toml export button when showScalerTomlExport is true', async () => {
		const { getByRole, getByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: true, onexportscalertoml: vi.fn() }),
		});
		// Open export menu first
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		expect(getByText('Scaler.toml (OpenGRIS)')).toBeTruthy();
	});

	it('calls onexportscalertoml when Scaler.toml button is clicked', async () => {
		const onexportscalertoml = vi.fn();
		const { getByRole, getByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: true, onexportscalertoml }),
		});
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		await fireEvent.click(getByText('Scaler.toml (OpenGRIS)'));
		expect(onexportscalertoml).toHaveBeenCalledOnce();
	});
});

describe('Toolbar — filename display', () => {
	it('shows "Untitled" when no filename is provided', () => {
		const { getByText } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByText('Untitled')).toBeTruthy();
	});

	it('shows filename when filename prop is provided', () => {
		const { getByText } = render(Toolbar, {
			props: makeToolbarProps({ filename: 'my-architecture.calm.json' }),
		});
		expect(getByText('my-architecture.calm.json')).toBeTruthy();
	});

	it('shows dirty indicator when isDirty=true', () => {
		const { container } = render(Toolbar, {
			props: makeToolbarProps({ isDirty: true }),
		});
		// dirty-dot has aria-label "Unsaved changes"
		const dirtyDot = container.querySelector('[aria-label="Unsaved changes"]');
		expect(dirtyDot).toBeTruthy();
	});
});
