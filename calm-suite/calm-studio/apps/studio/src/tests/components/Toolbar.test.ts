// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Toolbar from '$lib/toolbar/Toolbar.svelte';
import { resetModel } from '$lib/stores/calmModel.svelte';

// ─── Fixtures: create required callback props ─────────────────────────────────

function makeToolbarProps(overrides?: Record<string, unknown>) {
	return {
		onopen: vi.fn(),
		onsave: vi.fn(),
		onsaveas: vi.fn(),
		onnew: vi.fn(),
		onvalidate: vi.fn(),
		onexportcalm: vi.fn(),
		onexportzip: vi.fn(),
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

	it('renders the Save / Export dropdown with accessible name (a11y)', () => {
		const { getByRole } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByRole('button', { name: /save or export diagram/i })).toBeTruthy();
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

	it('calls onsave from the Save item in the Save / Export menu', async () => {
		const onsave = vi.fn();
		const { getByRole, getByText } = render(Toolbar, { props: makeToolbarProps({ onsave }) });
		await fireEvent.click(getByRole('button', { name: /save or export diagram/i }));
		await fireEvent.click(getByText('Save'));
		expect(onsave).toHaveBeenCalledOnce();
	});

	it('calls onsaveas from the "Save as..." item in the menu', async () => {
		const onsaveas = vi.fn();
		const { getByRole, getByText } = render(Toolbar, { props: makeToolbarProps({ onsaveas }) });
		await fireEvent.click(getByRole('button', { name: /save or export diagram/i }));
		await fireEvent.click(getByText('Save as...'));
		expect(onsaveas).toHaveBeenCalledOnce();
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

describe('Toolbar — Scaler.toml export button', () => {
	it('does NOT render Scaler.toml export button when showScalerTomlExport is false', async () => {
		const { getByRole, queryByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: false }),
		});
		// Open export menu first
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		expect(queryByText('Scaler.toml')).toBeNull();
	});

	it('renders Scaler.toml export button when showScalerTomlExport is true', async () => {
		const { getByRole, getByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: true, onexportscalertoml: vi.fn() }),
		});
		// Open export menu first
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		expect(getByText('Scaler.toml')).toBeTruthy();
	});

	it('calls onexportscalertoml when Scaler.toml button is clicked', async () => {
		const onexportscalertoml = vi.fn();
		const { getByRole, getByText } = render(Toolbar, {
			props: makeToolbarProps({ showScalerTomlExport: true, onexportscalertoml }),
		});
		await fireEvent.click(getByRole('button', { name: /export diagram/i }));
		await fireEvent.click(getByText('Scaler.toml'));
		expect(onexportscalertoml).toHaveBeenCalledOnce();
	});
});

describe('Toolbar — filename display', () => {
	it('shows "Unsaved Document" placeholder when no filename is provided', () => {
		const { getByPlaceholderText } = render(Toolbar, { props: makeToolbarProps() });
		expect(getByPlaceholderText('Unsaved Document')).toBeTruthy();
	});

	it('shows filename as the editable title value when provided', () => {
		const { getByDisplayValue } = render(Toolbar, {
			props: makeToolbarProps({ filename: 'my-architecture.calm.json' }),
		});
		expect(getByDisplayValue('my-architecture.calm.json')).toBeTruthy();
	});

	it('editing the title fires onrename with the new name', async () => {
		const onrename = vi.fn();
		const { getByRole } = render(Toolbar, { props: makeToolbarProps({ onrename }) });
		const input = getByRole('textbox', { name: /document name/i });
		await fireEvent.input(input, { target: { value: 'renamed-arch' } });
		await fireEvent.change(input);
		expect(onrename).toHaveBeenCalledWith('renamed-arch');
	});

	it('shows dirty indicator when isDirty=true', () => {
		const { container } = render(Toolbar, {
			props: makeToolbarProps({ isDirty: true }),
		});
		// dirty indicator has aria-label describing the unsaved state
		const dirtyDot = container.querySelector('[aria-label="Changes have been made since last save"]');
		expect(dirtyDot).toBeTruthy();
	});
});

describe('Toolbar — no C4 level selector (link-based navigation)', () => {
	it('does not render Context/Container/Component level buttons', () => {
		const { getAllByRole } = render(Toolbar, { props: makeToolbarProps() });
		const texts = getAllByRole('button').map((b) => b.textContent?.trim());
		expect(texts).not.toContain('Context');
		expect(texts).not.toContain('Container');
		expect(texts).not.toContain('Component');
	});
});
