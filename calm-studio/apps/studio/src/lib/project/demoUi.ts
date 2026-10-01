// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Demo UI gate (R84): toolbar Demos + bundled FluxNova/OpenGRIS template tabs.
 */

import type { CalmProjectConfig } from './types';

/** Studio-bundled template categories hidden when `ui.demo` is false. */
export const DEMO_TEMPLATE_CATEGORIES = ['fluxnova', 'opengris'] as const;

export type DemoTemplateCategory = (typeof DEMO_TEMPLATE_CATEGORIES)[number];

export function isDemoTemplateCategory(category: string): boolean {
	return (DEMO_TEMPLATE_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Effective `ui.demo` for a loaded project file.
 * Missing `ui` / `ui.demo` → false.
 */
export function isProjectDemoEnabled(config: CalmProjectConfig | null | undefined): boolean {
	return config?.ui?.demo === true;
}

/**
 * Whether Demos button and FluxNova/OpenGRIS tabs should show.
 * No project open → always show. With project → only when `ui.demo` is true.
 */
export function shouldShowDemoUi(
	hasProject: boolean,
	config: CalmProjectConfig | null | undefined
): boolean {
	if (!hasProject) return true;
	return isProjectDemoEnabled(config);
}

/** Filter template category keys for the picker when demo UI is off. */
export function filterTemplateCategoriesForDemo(
	categories: string[],
	showDemoUi: boolean
): string[] {
	if (showDemoUi) return categories;
	return categories.filter((c) => !isDemoTemplateCategory(c));
}
