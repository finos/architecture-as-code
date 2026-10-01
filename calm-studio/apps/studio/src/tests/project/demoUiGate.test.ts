// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';
import {
	DEMO_TEMPLATE_CATEGORIES,
	filterTemplateCategoriesForDemo,
	isDemoTemplateCategory,
	isProjectDemoEnabled,
	shouldShowDemoUi,
} from '$lib/project/demoUi';

describe('demo UI gate (R84)', () => {
	it('defaults ui.demo to false on new project config', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(cfg.ui?.demo).toBe(false);
		expect(isProjectDemoEnabled(cfg)).toBe(false);
	});

	it('treats missing ui / ui.demo as disabled', () => {
		const cfg = createDefaultProjectConfig('onebank');
		delete cfg.ui;
		expect(isProjectDemoEnabled(cfg)).toBe(false);
		expect(isProjectDemoEnabled(null)).toBe(false);
		expect(isProjectDemoEnabled(undefined)).toBe(false);
	});

	it('enables only when ui.demo is true', () => {
		const cfg = createDefaultProjectConfig('onebank');
		cfg.ui = { demo: true };
		expect(isProjectDemoEnabled(cfg)).toBe(true);
	});

	it('shows demo UI when no project is open', () => {
		expect(shouldShowDemoUi(false, null)).toBe(true);
		expect(shouldShowDemoUi(false, createDefaultProjectConfig())).toBe(true);
	});

	it('hides demo UI for a project unless ui.demo is true', () => {
		const off = createDefaultProjectConfig('onebank');
		expect(shouldShowDemoUi(true, off)).toBe(false);
		expect(shouldShowDemoUi(true, { ...off, ui: { demo: true } })).toBe(true);
	});

	it('filters FluxNova and OpenGRIS categories when demo UI is off', () => {
		const cats = ['fluxnova', 'ai-governance', 'general', 'opengris', 'patterns', 'hub:ns'];
		expect(filterTemplateCategoriesForDemo(cats, true)).toEqual(cats);
		expect(filterTemplateCategoriesForDemo(cats, false)).toEqual([
			'ai-governance',
			'general',
			'patterns',
			'hub:ns',
		]);
		for (const c of DEMO_TEMPLATE_CATEGORIES) {
			expect(isDemoTemplateCategory(c)).toBe(true);
		}
		expect(isDemoTemplateCategory('general')).toBe(false);
	});

	it('accepts optional ui.demo on .calmrj', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(isCalmProjectConfig({ ...cfg, ui: { demo: true } })).toBe(true);
		expect(isCalmProjectConfig({ ...cfg, ui: { demo: false } })).toBe(true);
		expect(isCalmProjectConfig({ ...cfg, ui: { demo: 'yes' } } as unknown)).toBe(false);
		expect(isCalmProjectConfig({ ...cfg, ui: [] } as unknown)).toBe(false);
	});
});
