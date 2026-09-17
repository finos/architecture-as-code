// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for Messaging node types (16x16 viewBox, stroke-based).

/** SVG icon strings for Messaging node types. */
export const messagingIcons: Record<string, string> = {
  'message-broker': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="4" width="6" height="8" rx="1.5"/><path d="M2 7h3M11 7h3M2 10h3M11 10h3" stroke-linecap="round"/><path d="M7 7h2M7 9h2" stroke-linecap="round"/></svg>`,

  'event-stream': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 4h12M2 8h12M2 12h12" stroke-linecap="round"/><path d="M10 2l2 2-2 2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l-2 2 2 2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10l2 2-2 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'message-queue': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/><path d="M5 5h3M5 11h3" stroke-linecap="round"/><path d="M11 5l1-1M11 11l1-1" stroke-linecap="round"/></svg>`,

  'pub-sub': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2"/><path d="M8 6V2M8 14v-4M6 8H2M14 8h-4" stroke-linecap="round"/><circle cx="8" cy="2" r="1"/><circle cx="8" cy="14" r="1"/><circle cx="2" cy="8" r="1"/><circle cx="14" cy="8" r="1"/></svg>`,

  'event-bus': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 8h10" stroke-linecap="round" stroke-width="2"/><path d="M5 4v4M8 4v4M11 4v4M5 8v4M8 8v4M11 8v4" stroke-linecap="round"/></svg>`,

  'stream-processor': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 5h4l2 3-2 3H2" stroke-linejoin="round"/><path d="M8 5h4l2 3-2 3H8" stroke-linejoin="round"/><circle cx="5" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`,

  'schema-registry': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 5h4M6 7.5h4M6 10h2" stroke-linecap="round"/><path d="M10 9.5l1.5 1.5L10 12.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'notification-service': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 6c0-1.7 1.3-3 3-3s3 1.3 3 3v3l1.5 1.5H3.5L5 9V6Z" stroke-linejoin="round"/><path d="M6.5 12.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5" stroke-linecap="round"/></svg>`,
};
