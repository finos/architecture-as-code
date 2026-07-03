// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for FluxNova node types (16x16 viewBox, stroke-based).

/** SVG icon strings for FluxNova node types. */
export const fluxnovaIcons: Record<string, string> = {
  engine: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5" stroke-linecap="round"/><path d="M8 5.5A2.5 2.5 0 0 1 10.5 8" stroke-linecap="round"/></svg>`,

  'rest-api': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="5" width="12" height="6" rx="1.5"/><path d="M5 8h2M9 8h2" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/><path d="M5 6.5v3M11 6.5v3" stroke-linecap="round"/></svg>`,

  cockpit: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="9" r="5.5"/><path d="M8 9L5.5 6.5" stroke-linecap="round"/><circle cx="8" cy="9" r="1"/><path d="M4 9h1M11 9h1M8 4v1" stroke-linecap="round"/><path d="M5.2 6.2l.7.7M10.8 6.2l-.7.7" stroke-linecap="round"/></svg>`,

  admin: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="7" cy="5" r="2.5"/><path d="M3 13c0-2 1.8-3.5 4-3.5" stroke-linecap="round"/><path d="M11 8.5L12.5 10 15 7.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11.5" cy="11.5" r="2.5"/></svg>`,

  tasklist: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 6l1.5 1.5L10 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9.5h4M6 11.5h3" stroke-linecap="round"/></svg>`,

  modeler: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="5" height="4" rx="1"/><rect x="9" y="2" width="5" height="4" rx="1"/><rect x="5" y="10" width="6" height="4" rx="1"/><path d="M4.5 6v2h7V6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8v2" stroke-linecap="round"/></svg>`,

  'external-task-worker': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="8" height="10" rx="1.5"/><path d="M5 6h2M5 8.5h2" stroke-linecap="round"/><circle cx="6" cy="11" r="0.5" fill="currentColor"/><path d="M12 6l2 2-2 2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8h-4" stroke-linecap="round"/></svg>`,

  'dmn-engine': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2l5 4v4l-5 4L3 10V6L8 2Z" stroke-linejoin="round"/><path d="M5.5 8l2 2 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'process-db': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" stroke-linecap="round"/><path d="M6 9.5l1 1 2-2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  platform: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 6h14" stroke-linecap="round"/><rect x="3" y="8.5" width="4" height="2.5" rx="0.8"/><rect x="9" y="8.5" width="4" height="2.5" rx="0.8"/><path d="M5 6V4.5M11 6V4.5" stroke-linecap="round"/></svg>`,
};
