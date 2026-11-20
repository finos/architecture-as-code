// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { coreIcons } from '../icons/core.js';

const coreColor: PackColor = {
  bg: '#f8f9fa',
  border: '#6366f1',
  stroke: '#4f46e5',
  badge: '[CALM]',
};

function node(
  typeId: string,
  label: string,
  description: string,
  color: PackColor = { bg: '#f0f0ff', border: '#6366f1', stroke: '#4f46e5' },
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: coreIcons[typeId]!,
    color,
    description,
  };
}

export const corePack: PackDefinition = {
  id: 'core',
  label: 'CALM Core',
  version: '1.0.0',
  color: coreColor,
  nodes: [
    node('actor', 'Actor', 'A human or external entity that interacts with the system'),
    node('system', 'System', 'A bounded software system within the architecture'),
    node('service', 'Service', 'An independently deployable unit of functionality'),
    node('database', 'Database', 'A persistent data store'),
    node('network', 'Network', 'A network boundary or zone'),
    node('webclient', 'Web Client', 'A browser-based frontend client'),
    node('ecosystem', 'Ecosystem', 'A logical grouping of systems and services'),
    node('ldap', 'LDAP', 'An LDAP directory service for identity management'),
    node('data-asset', 'Data Asset', 'A named data asset or data flow in the architecture'),
  ],
};
