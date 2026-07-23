// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TemplatePicker from '$lib/templates/TemplatePicker.svelte';
import { initAllTemplates, getAllTemplates, getAllCategories } from '$lib/templates/registry';

// ─── Setup: register all templates once ────────────────────────────────────

beforeEach(() => {
	// initAllTemplates is idempotent (registerTemplate overwrites on duplicate ID)
	initAllTemplates();
});

describe('TemplatePicker', () => {
	it('renders "Start from a template" modal title', () => {
		const { getByText } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		expect(getByText(/start from a template/i)).toBeTruthy();
	});

	it('renders close button with accessible name (a11y)', () => {
		const { getByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		const closeBtn = getByRole('button', { name: /close template picker/i });
		expect(closeBtn).toBeTruthy();
	});

	it('close button is focusable (not disabled)', () => {
		const { getByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		const closeBtn = getByRole('button', { name: /close template picker/i }) as HTMLButtonElement;
		expect(closeBtn.disabled).toBe(false);
	});

	it('calls oncancel when close button is clicked', async () => {
		const oncancel = vi.fn();
		const { getByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel },
		});
		await fireEvent.click(getByRole('button', { name: /close template picker/i }));
		expect(oncancel).toHaveBeenCalledOnce();
	});

	it('renders category tab buttons for all registered categories', () => {
		const categories = getAllCategories();
		const { getAllByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		const tabs = getAllByRole('tab');
		// Each category should have a corresponding tab button
		expect(tabs.length).toBeGreaterThanOrEqual(categories.length);
	});

	it('category tabs have aria-selected attribute (a11y tablist)', () => {
		const { getAllByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		const tabs = getAllByRole('tab');
		// At least one tab should be selected
		const selectedTabs = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
		expect(selectedTabs.length).toBeGreaterThanOrEqual(1);
	});

	it('renders template cards for the active category', () => {
		const allTemplates = getAllTemplates();
		expect(allTemplates.length).toBeGreaterThan(0);

		const { getAllByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		// Template cards are buttons with aria-label "Load template: ..."
		const templateCards = getAllByRole('button', { name: /load template/i });
		expect(templateCards.length).toBeGreaterThan(0);
	});

	it('calls onselect with template id when a template card is clicked', async () => {
		const onselect = vi.fn();
		const allTemplates = getAllTemplates();
		const firstTemplate = allTemplates[0];

		const { getByRole } = render(TemplatePicker, {
			props: { onselect, oncancel: vi.fn() },
		});

		// Click the template card for the first template
		const templateCard = getByRole('button', {
			name: new RegExp(`load template.*${firstTemplate._template.name}`, 'i'),
		});
		await fireEvent.click(templateCard);
		expect(onselect).toHaveBeenCalledWith(firstTemplate._template.id);
	});

	it('tablist has accessible name (a11y)', () => {
		const { getByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		// Category tablist should have accessible label
		const tablist = getByRole('tablist', { name: /template categories/i });
		expect(tablist).toBeTruthy();
	});

	it('dialog has modal role with accessible name (a11y)', () => {
		const { getByRole } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		const dialog = getByRole('dialog', { name: /template picker/i });
		expect(dialog).toBeTruthy();
	});

	it('renders template descriptions in cards', () => {
		const allTemplates = getAllTemplates();
		const firstTemplate = allTemplates[0];

		const { getByText } = render(TemplatePicker, {
			props: { onselect: vi.fn(), oncancel: vi.fn() },
		});
		// Description text should be visible for the first template in active category
		// (may not be visible if it's in a different category than the active one)
		// Just verify description appears somewhere for at least one template
		const activeCategory = getAllCategories()[0];
		const activeTemplates = allTemplates.filter(
			(t) => t._template.category === activeCategory
		);
		if (activeTemplates.length > 0) {
			const firstActiveTemplate = activeTemplates[0];
			expect(getByText(firstActiveTemplate._template.description)).toBeTruthy();
		}
	});
});
