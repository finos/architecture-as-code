// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for OpenGRIS node types (16x16 viewBox, stroke-based).

/** SVG icon strings for OpenGRIS node types. */
export const opengrisIcons: Record<string, string> = {
  scheduler: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5" stroke-linecap="round"/></svg>`,

  worker: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M8 6v4M6 8h4" stroke-linecap="round"/></svg>`,

  'worker-manager': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke-dasharray="3 1.5"/><rect x="3" y="6" width="4" height="4" rx="1"/><rect x="9" y="6" width="4" height="4" rx="1"/></svg>`,

  client: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M5 14h6M8 11v3" stroke-linecap="round"/></svg>`,

  'object-storage': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" stroke-linecap="round"/></svg>`,

  cluster: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="2" width="14" height="12" rx="2"/><rect x="3" y="5" width="3" height="3" rx="0.7"/><rect x="7" y="5" width="3" height="3" rx="0.7"/><rect x="5" y="9" width="3" height="3" rx="0.7"/></svg>`,

  'task-graph': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="3" cy="8" r="2"/><circle cx="13" cy="4" r="2"/><circle cx="13" cy="12" r="2"/><path d="M5 8l6-3M5 8l6 3" stroke-linecap="round"/></svg>`,

  'parallel-function': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 3v10M7 3v10M10 3v10" stroke-linecap="round"/><path d="M12 8l2 0M14 8l-2-2M14 8l-2 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
