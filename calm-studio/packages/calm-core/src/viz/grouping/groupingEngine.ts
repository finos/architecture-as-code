// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture } from '../../types.js';
import type { Dimension } from './dimensions.js';

export interface VirtualGroup {
  id: string;
  label: string;
  childrenIds: string[];
}

export interface GroupingResult {
  virtualGroups: Map<string, VirtualGroup>;
  nodeToGroup: Map<string, string>;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function applyGrouping(
  arch: CalmArchitecture,
  dim: Dimension,
  opts?: { key?: string },
): GroupingResult {
  const virtualGroups = new Map<string, VirtualGroup>();
  const nodeToGroup = new Map<string, string>();

  for (const node of arch.nodes ?? []) {
    const value = dim.extract(node, arch, opts);
    if (!value) continue;
    const id = `vg-${dim.key}-${normalize(value)}`;
    let group = virtualGroups.get(id);
    if (!group) {
      group = { id, label: value, childrenIds: [] };
      virtualGroups.set(id, group);
    }
    group.childrenIds.push(node['unique-id']);
    nodeToGroup.set(node['unique-id'], id);
  }

  return { virtualGroups, nodeToGroup };
}
