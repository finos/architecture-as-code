// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for Kubernetes resource types (16x16 viewBox, stroke-based).

/** SVG icon strings for Kubernetes resource node types. */
export const k8sIcons: Record<string, string> = {
  pod: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="8" rx="5.5" ry="4"/><circle cx="8" cy="8" r="2"/></svg>`,

  deployment: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="5" width="5" height="4" rx="1"/><rect x="9" y="5" width="5" height="4" rx="1"/><path d="M7 7h2" stroke-linecap="round"/><path d="M4.5 3v2M11.5 3v2M4.5 9v2M11.5 9v2" stroke-linecap="round"/></svg>`,

  statefulset: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="9" y="3" width="4" height="4" rx="1"/><rect x="3" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/><path d="M7 5h2M5 7v2M9 7v2M7 11h2" stroke-linecap="round"/></svg>`,

  daemonset: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="8" rx="5.5" ry="4"/><path d="M5 8h6M8 5v6" stroke-linecap="round"/></svg>`,

  job: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 8l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  cronjob: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 4l1.5 1.5" stroke-linecap="round"/></svg>`,

  service: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v8M5 5.5l6 5M11 5.5l-6 5" stroke-linecap="round"/></svg>`,

  ingress: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 8h7M4 5l4 3-4 3" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="4" width="6" height="8" rx="1.5"/><path d="M11 7h2M11 9h2" stroke-linecap="round"/></svg>`,

  configmap: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 6h6M5 8h4M5 10h5" stroke-linecap="round"/></svg>`,

  secret: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="7.5" width="10" height="6.5" rx="1.5"/><path d="M5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2"/><circle cx="8" cy="10.5" r="1"/><path d="M8 11.5v1" stroke-linecap="round"/></svg>`,

  'persistent-volume': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="2"/><circle cx="8" cy="8" r="2.5"/><path d="M5 4V2.5M11 4V2.5M5 12v1.5M11 12v1.5" stroke-linecap="round"/></svg>`,

  pvc: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="2"/><path d="M6 8h4M8 6v4" stroke-linecap="round"/></svg>`,

  namespace: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5"/></svg>`,

  hpa: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="6" width="3" height="4" rx="0.8"/><rect x="6.5" y="4" width="3" height="8" rx="0.8"/><rect x="11" y="2" width="3" height="12" rx="0.8"/><path d="M1 13.5h14" stroke-linecap="round"/></svg>`,
};
