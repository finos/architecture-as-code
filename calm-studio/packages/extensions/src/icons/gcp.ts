// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for GCP services (16x16 viewBox, stroke-based).
// These are original creative works, NOT copies of official GCP icons.

/** SVG icon strings for GCP service node types. */
export const gcpIcons: Record<string, string> = {
  'cloud-run': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 8l4-5 4 5-4 5-4-5Z" stroke-linejoin="round"/><path d="M8 3v10" stroke-linecap="round"/></svg>`,

  'cloud-functions': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 13L7 3l2.5 5L12 3l-1 10" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 9.5h5" stroke-linecap="round"/></svg>`,

  gke: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><polygon points="8,2 14,5.5 14,10.5 8,14 2,10.5 2,5.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.5"/><path d="M8 2v3.5M8 10.5V14M2 5.5l3 2M11 8.5l3 2M14 5.5l-3 2M5 8.5l-3 2"/></svg>`,

  'cloud-sql': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/></svg>`,

  bigquery: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3.5 3.5" stroke-linecap="round" stroke-width="1.8"/><path d="M5 7h4M7 5v4" stroke-linecap="round"/></svg>`,

  'pub-sub': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="3"/><path d="M8 5V2M11 6l2-2M12 9l2 1M8 11v3M5 10l-2 2M4 7L2 6" stroke-linecap="round"/></svg>`,

  'cloud-storage': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 5v6L8 14L2 11V5L8 2Z" stroke-linejoin="round"/><ellipse cx="8" cy="5" rx="3" ry="1.2"/><path d="M5 5v6M11 5v6" stroke-linecap="round"/></svg>`,

  firestore: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 2h8v12H4Z" rx="1"/><path d="M6 5h4M6 7.5h4M6 10h3" stroke-linecap="round"/></svg>`,

  spanner: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3" stroke-linecap="round"/></svg>`,

  'cloud-cdn': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><path d="M2 8h12M3 5h10M3 11h10" stroke-linecap="round"/></svg>`,

  'cloud-dns': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6"/><path d="M5 3.5Q8 6 8 8t-3 4.5M11 3.5Q8 6 8 8t3 4.5" stroke-linecap="round"/><path d="M2 8h12" stroke-linecap="round"/></svg>`,

  'cloud-armor': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 4.5V9C14 12 11.5 14.5 8 15 4.5 14.5 2 12 2 9V4.5L8 2Z" stroke-linejoin="round"/><path d="M5.5 8.5l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'vertex-ai': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="5" width="12" height="7" rx="1.5"/><path d="M5 5V3.5a3 3 0 0 1 6 0V5"/><circle cx="8" cy="8.5" r="1.5"/><path d="M5 8.5h1.5M10.5 8.5H12" stroke-linecap="round"/></svg>`,

  'cloud-endpoints': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="5" width="14" height="6" rx="1.5"/><path d="M5 8h6M3 8v0M13 8v0" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/></svg>`,

  memorystore: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M6 8l1.5 1.5L11 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
