// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * theme.svelte.ts — Dark mode toggle with system preference detection.
 *
 * initTheme(): call on mount — reads localStorage, falls back to system preference,
 *   applies 'dark' class to <html>, and registers system preference listener.
 * toggleTheme(): flips isDark, updates localStorage + document class.
 * isDark: reactive boolean — true when dark mode active.
 */

const STORAGE_KEY = 'calmstudio-theme';

// Module-level Svelte 5 rune state
let _isDark = $state(false);

/** Reactive getter for current dark mode state. */
export function isDark(): boolean {
	return _isDark;
}

/**
 * Initialize theme from localStorage (persisted preference) or system setting.
 * MUST be called in onMount to ensure DOM access.
 */
export function initTheme(): void {
	const stored = localStorage.getItem(STORAGE_KEY);

	if (stored !== null) {
		_isDark = stored === 'dark';
	} else {
		_isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	applyClass(_isDark);

	// Listen to system preference changes (only applies when no stored preference)
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
		if (localStorage.getItem(STORAGE_KEY) === null) {
			_isDark = e.matches;
			applyClass(_isDark);
		}
	});
}

/**
 * Toggle between dark and light mode.
 * Persists the choice to localStorage.
 */
export function toggleTheme(): void {
	_isDark = !_isDark;
	localStorage.setItem(STORAGE_KEY, _isDark ? 'dark' : 'light');
	applyClass(_isDark);
}

function applyClass(dark: boolean): void {
	if (dark) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
}
