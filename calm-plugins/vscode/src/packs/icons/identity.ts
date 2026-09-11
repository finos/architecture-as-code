// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for Identity & Access node types (16x16 viewBox, stroke-based).

/** SVG icon strings for Identity & Access node types. */
export const identityIcons: Record<string, string> = {
  'identity-provider': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="5" r="2.5"/><path d="M4 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke-linecap="round"/><path d="M12 3l1 1-1 1M14 4h-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'oauth-server': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="5" width="10" height="7" rx="1.5"/><path d="M8 2v3" stroke-linecap="round"/><circle cx="8" cy="9" r="1.5"/><path d="M8 10.5V11" stroke-linecap="round"/><circle cx="5" cy="2" r="1"/><circle cx="11" cy="2" r="1"/><path d="M6 2h4" stroke-linecap="round"/></svg>`,

  'oidc-provider': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2.5 2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`,

  'saml-provider': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="5" height="4" rx="1"/><rect x="9" y="9" width="5" height="4" rx="1"/><path d="M7 5h2l3 4h-2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7v2l3 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'certificate-authority': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="2" width="10" height="8" rx="1.5"/><path d="M6.5 6l1 1 2-2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v4l2-1 2 1v-4" stroke-linejoin="round"/></svg>`,

  'token-service': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="4.5"/><path d="M8 5.5v5M6 8h4" stroke-linecap="round"/><path d="M13 3l1 1M13 13l1-1M2 3l1 1M2 13l1-1" stroke-linecap="round"/></svg>`,

  'mfa-service': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="6" width="5" height="7" rx="1"/><path d="M3.5 9h2M3.5 11h2" stroke-linecap="round"/><rect x="9" y="3" width="5" height="5" rx="1"/><path d="M10.5 5.5h2" stroke-linecap="round"/><path d="M11.5 4v3" stroke-linecap="round"/><path d="M9 10h5v3H9z" rx="1"/><circle cx="11.5" cy="11.5" r="0.5" fill="currentColor" stroke="none"/></svg>`,

  'policy-engine': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L3 4.5v4c0 3 2.2 5 5 6.5 2.8-1.5 5-3.5 5-6.5v-4L8 2Z" stroke-linejoin="round"/><path d="M6 8l1.5 1.5L10 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
