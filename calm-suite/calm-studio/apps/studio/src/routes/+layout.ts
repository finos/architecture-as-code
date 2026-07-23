// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

// Disable SSR project-wide — required for Tauri webview (window.__TAURI_INTERNALS__
// is not available during server-side rendering) and for SvelteKit adapter-static.
export const ssr = false;
export const prerender = false;
