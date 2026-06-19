// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture, CalmNode } from '../../types.js';

export function getNested(obj: unknown, dottedPath: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = dottedPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function findContainerViaComposedOf(arch: CalmArchitecture, nodeId: string): string | null {
  for (const rel of arch.relationships ?? []) {
    const co = (rel['relationship-type'] as { 'composed-of'?: { container?: string; nodes?: string[] } })?.[
      'composed-of'
    ];
    if (co && Array.isArray(co.nodes) && co.nodes.includes(nodeId) && typeof co.container === 'string') {
      return co.container;
    }
  }
  return null;
}

export interface Dimension {
  key: string;
  label: string;
  extract: (node: CalmNode, arch: CalmArchitecture, opts?: { key?: string }) => string | null;
}

export const dimensions = {
  container: {
    key: 'container',
    label: 'Container',
    extract: (node, arch) => findContainerViaComposedOf(arch, node['unique-id']),
  },
  nodeType: {
    key: 'nodeType',
    label: 'Node type',
    extract: (node) => {
      const t = node['node-type'];
      return typeof t === 'string' && t.length > 0 ? t : null;
    },
  },
  aiDomain: {
    key: 'aiDomain',
    label: 'AI domain',
    extract: (node) => {
      const t = node['node-type'];
      if (typeof t !== 'string') return null;
      const m = t.match(/^ai:([\w-]+)/);
      return m && typeof m[1] === 'string' ? m[1] : null;
    },
  },
  owner: {
    key: 'owner',
    label: 'Owner',
    extract: (node) => {
      const o = (node as unknown as { metadata?: { owner?: unknown } }).metadata?.owner;
      return typeof o === 'string' ? o : null;
    },
  },
  customKey: {
    key: 'customKey',
    label: 'Custom key',
    extract: (node, _arch, opts) => {
      const key = opts?.key;
      if (!key) return null;
      const v = getNested(node, key);
      return typeof v === 'string' ? v : null;
    },
  },
} as const satisfies Record<string, Dimension>;
