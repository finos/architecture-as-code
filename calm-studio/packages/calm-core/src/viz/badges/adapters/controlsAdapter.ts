// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { Badge, BadgeAdapter, Severity } from '../types.js';
import type { CalmNode } from '../../../types.js';

function countMitigations(node: CalmNode): { controls: number; mitigations: number } {
  const controls = (node as unknown as { controls?: Record<string, unknown> }).controls;
  if (!controls || typeof controls !== 'object') return { controls: 0, mitigations: 0 };
  let mitigations = 0;
  const controlIds = Object.keys(controls);
  for (const id of controlIds) {
    const entry = controls[id] as { requirements?: Array<{ config?: { mitigates?: unknown } }> } | undefined;
    const reqs = entry?.requirements ?? [];
    for (const r of reqs) {
      const mits = r?.config?.mitigates;
      if (Array.isArray(mits)) mitigations += mits.length;
    }
  }
  return { controls: controlIds.length, mitigations };
}

/**
 * Severity scales by total mitigations (sum of `mitigates[]` lengths across all
 * requirements), not raw control count — the badge signals "how much threat
 * surface is being addressed", not "how many controls happen to be declared".
 * A node with one control mitigating ten threats outweighs a node with five
 * controls each mitigating one.
 */
function severityFromMitigations(mitigations: number): Severity {
  if (mitigations >= 10) return 'high';
  if (mitigations >= 5) return 'medium';
  if (mitigations >= 1) return 'low';
  return 'unknown';
}

export const controlsAdapter: BadgeAdapter = {
  name: 'controls',
  forNode: (node: CalmNode): Badge[] => {
    const { controls, mitigations } = countMitigations(node);
    if (controls === 0) return [];
    return [
      {
        id: `controls-${node['unique-id']}`,
        source: 'controls',
        kind: 'count',
        severity: severityFromMitigations(mitigations),
        label: `${controls} control${controls === 1 ? '' : 's'}`,
        data: { count: controls, mitigations },
      },
    ];
  },
  forEdge: (): Badge[] => [],
};
