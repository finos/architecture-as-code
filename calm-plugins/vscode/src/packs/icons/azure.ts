// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted ABSTRACT SVG icons for Azure services (16x16 viewBox, stroke-based).
// These are ENTIRELY ORIGINAL creative works — NOT Microsoft official Azure icons.
// Per licensing research: Microsoft Azure icons require license agreement.
// All icons here are abstract geometric representations only.

/** SVG icon strings for Azure service node types. */
export const azureIcons: Record<string, string> = {
  functions: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 13L6 3l2.5 5L11 3l-1 10" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 9.5h6" stroke-linecap="round"/></svg>`,

  'app-service': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 7h12"/><path d="M5 5h0.1M7 5h0.1M9 5h0.1" stroke-linecap="round" stroke-width="1.5"/></svg>`,

  aks: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><polygon points="8,2 14,5.5 14,10.5 8,14 2,10.5 2,5.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2"/></svg>`,

  'sql-database': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2"/></svg>`,

  'cosmos-db': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><ellipse cx="8" cy="8" rx="2.5" ry="5.5"/><path d="M2.5 8h11" stroke-linecap="round"/></svg>`,

  'service-bus': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 8h2M7 8h2M10 8h2" stroke-linecap="round"/><path d="M13 4V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1"/></svg>`,

  'blob-storage': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 5v6L8 14L2 11V5L8 2Z" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.5"/></svg>`,

  'front-door': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 8h7M4 5l4 3-4 3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="5.5"/></svg>`,

  'api-management': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="5" width="14" height="6" rx="1.5"/><path d="M5 8h6" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/></svg>`,

  'key-vault': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="7.5" width="10" height="6.5" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2"/><circle cx="8" cy="10.5" r="1.2"/><path d="M8 11.7v1.3" stroke-linecap="round"/></svg>`,

  'active-directory': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="5.5" r="2.5"/><path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke-linecap="round"/><circle cx="3" cy="5.5" r="1.5"/><path d="M1 11.5c0-1.5 1-2.5 2-2.5"/></svg>`,

  'cognitive-services': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="2"/><path d="M5 7h2M9 7h2M5 9.5h6" stroke-linecap="round"/><path d="M8 4V2.5" stroke-linecap="round"/></svg>`,

  'event-hub': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 4l4 4-4 4M6 8h8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="8" r="1.5"/></svg>`,

  'redis-cache': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M5.5 8.5l1 1 2.5-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'container-instances': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>`,
};
