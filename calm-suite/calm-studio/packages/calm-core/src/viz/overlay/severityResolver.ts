// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { BadgeIndex, Severity } from '../badges/types.js';
import type { CalmArchitecture } from '../../types.js';

const RANK: Record<Severity, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface SeverityIndex {
  forNode: (id: string) => Severity;
}

export function createSeverityResolver(badgeIndex: BadgeIndex, arch: CalmArchitecture): SeverityIndex {
  const cache = new Map<string, Severity>();
  for (const node of arch.nodes ?? []) {
    const id = node['unique-id'];
    let maxSev: Severity = 'unknown';
    for (const b of badgeIndex.forNode(id)) {
      const s = b.severity ?? 'unknown';
      if (RANK[s] > RANK[maxSev]) maxSev = s;
    }
    cache.set(id, maxSev);
  }
  return {
    forNode: (id: string) => cache.get(id) ?? 'unknown',
  };
}
