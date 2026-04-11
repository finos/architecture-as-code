// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Hand-crafted abstract SVG icons for AI/Agentic node types (16x16 viewBox, stroke-based).

/** SVG icon strings for AI/Agentic node types. */
export const aiIcons: Record<string, string> = {
  llm: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="2"/><path d="M5 7h2M9 7h2M5 9.5h6" stroke-linecap="round"/></svg>`,

  agent: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="6" r="3"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke-linecap="round"/><path d="M8 9v2" stroke-linecap="round"/><path d="M6 12h4" stroke-linecap="round"/></svg>`,

  orchestrator: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v3.5M8 10.5V14M2 8h3.5M10.5 8H14" stroke-linecap="round"/><circle cx="8" cy="2" r="1.2"/><circle cx="8" cy="14" r="1.2"/><circle cx="2" cy="8" r="1.2"/><circle cx="14" cy="8" r="1.2"/></svg>`,

  'vector-store': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><ellipse cx="8" cy="5" rx="5" ry="2"/><path d="M3 5v6c0 1.1 2.24 2 5 2s5-.9 5-2V5"/><path d="M5 8l1 1 2-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  tool: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9.5 2C8 2 6.5 3 6.5 4.5c0 .5.2 1 .5 1.4L3 10l1 3 3-1 4-4c.4.3.9.5 1.4.5 1.5 0 2.5-1.5 2.5-3 0-.5-.1-1-.3-1.3L13 5.5l-1.5 1.5L10 5.5 11.5 4l-1.3-1.7C10 2.1 9.7 2 9.5 2Z" stroke-linejoin="round"/></svg>`,

  memory: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M5 4V2.5M8 4V2.5M11 4V2.5M5 12v1.5M8 12v1.5M11 12v1.5" stroke-linecap="round"/><path d="M2 7h12M2 9h12" stroke-linecap="round"/></svg>`,

  guardrail: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2L14 4.5V9C14 12 11.5 14.5 8 15 4.5 14.5 2 12 2 9V4.5L8 2Z" stroke-linejoin="round"/><path d="M5.5 8.5l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'embedding-model': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="5" width="12" height="6" rx="1.5"/><path d="M5 8h2M9 8h2" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/></svg>`,

  'rag-pipeline': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="6" width="4" height="4" rx="1"/><rect x="6" y="6" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/><path d="M5 8h1M10 8h1" stroke-linecap="round"/></svg>`,

  'prompt-template': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 6h6M5 8h4M5 10h5" stroke-linecap="round"/><path d="M10 3V1.5M10 13v1.5" stroke-linecap="round"/></svg>`,

  'api-gateway': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1" y="5" width="14" height="6" rx="1.5"/><path d="M5 8h6M3 8v0M13 8v0" stroke-linecap="round"/><path d="M7 5V3M9 5V3M7 11v2M9 11v2" stroke-linecap="round"/></svg>`,

  'human-in-the-loop': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="5" r="2.5"/><path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke-linecap="round"/><path d="M1 8h3M12 8h3" stroke-linecap="round"/><path d="M2 10l2-2-2-2M14 10l-2-2 2-2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  'knowledge-base': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 3h10v10H3Z" rx="1"/><path d="M6 3v10M3 6h10M3 9h10" stroke-linecap="round"/></svg>`,

  'eval-monitor': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="5.5"/><path d="M5 8l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1" stroke-linecap="round"/></svg>`,
};
