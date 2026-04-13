// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';

const coreColor: PackColor = {
  bg: '#f8f9fa',
  border: '#6366f1',
  stroke: '#4f46e5',
  badge: '[CALM]',
};

export const corePack: PackDefinition = {
  id: 'core',
  label: 'CALM Core',
  version: '1.0.0',
  color: coreColor,
  nodes: [
    {
      typeId: 'actor',
      label: 'Actor',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21c0-3.5 2.9-6.5 6.5-6.5s6.5 3 6.5 6.5" stroke-linecap="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A human or external entity that interacts with the system',
    },
    {
      typeId: 'system',
      label: 'System',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1" stroke-width="1.2"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A bounded software system within the architecture',
    },
    {
      typeId: 'service',
      label: 'Service',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'An independently deployable unit of functionality',
    },
    {
      typeId: 'database',
      label: 'Database',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-13"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A persistent data store',
    },
    {
      typeId: 'network',
      label: 'Network',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 19c-2.5 0-4.5-2-4.5-4.5 0-2.2 1.6-4.1 3.7-4.4C5.9 7.3 8.2 5 11 5c2.4 0 4.5 1.6 5.3 3.8.4-.2.8-.3 1.2-.3 1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5H6.5Z" stroke-linejoin="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A network boundary or zone',
    },
    {
      typeId: 'webclient',
      label: 'Web Client',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A browser-based frontend client',
    },
    {
      typeId: 'ecosystem',
      label: 'Ecosystem',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2Z" stroke-linejoin="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A logical grouping of systems and services',
    },
    {
      typeId: 'ldap',
      label: 'LDAP',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l8 3.5V11c0 5-3.5 9.7-8 11-4.5-1.3-8-6-8-11V5.5L12 2Z" stroke-linejoin="round"/><circle cx="12" cy="10" r="2" stroke-width="1.2"/><path d="M12 12v4M12 14h2" stroke-width="1.2" stroke-linecap="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'An LDAP directory service for identity management',
    },
    {
      typeId: 'data-asset',
      label: 'Data Asset',
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke-linejoin="round"/><path d="M15 2v5h5"/><path d="M8 10h8M8 13h8M8 16h5" stroke-width="1.2" stroke-linecap="round"/></svg>`,
      color: { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
      description: 'A named data asset or data flow in the architecture',
    },
  ],
};
