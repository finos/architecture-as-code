// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Pure helpers for AIGF governance decorator computation.
 * Mirrors the studio's export-time decorator generator (apps/studio/src/lib/io/export.ts)
 * so MCP-driven architecture mutations attach the same governance overlay shape that
 * exported artifacts carry. Idempotent: running on its own output produces the same value.
 */

import type {
  CalmArchitecture,
  CalmControls,
  CalmDecorator,
  CalmNode,
} from '@calmstudio/calm-core';
import { isAINode, getAIGFForNodeType } from '@calmstudio/calm-core';

/**
 * Stable unique-id used for the AIGF governance decorator. Lets the helper
 * locate-and-replace a stale decorator instead of appending duplicates.
 */
export const AIGF_DECORATOR_UNIQUE_ID = 'aigf-governance-overlay';

const AIGF_DECORATOR_TYPE = 'aigf-governance';
const AIGF_FRAMEWORK = 'FINOS AI Governance Framework';
const AIGF_VERSION = '2.0';

function isoDate(now: Date): string {
  return now.toISOString().split('T')[0]!;
}

function computeGovernanceScore(aiNodes: CalmNode[]): number {
  let totalRecommended = 0;
  let totalApplied = 0;
  for (const node of aiNodes) {
    const { mitigations } = getAIGFForNodeType(node['node-type']);
    const controls = (node as { controls?: CalmControls }).controls ?? {};
    totalRecommended += mitigations.length;
    for (const mit of mitigations) {
      if (controls[mit.calmControlKey] !== undefined) {
        totalApplied++;
      }
    }
  }
  if (totalRecommended === 0) return 100;
  return Math.round((totalApplied / totalRecommended) * 100);
}

/**
 * Recompute the AIGF governance decorator for the architecture.
 *
 * - If no AI nodes are present, any prior AIGF decorator is stripped.
 * - Otherwise, a fresh AIGF decorator replaces any prior one.
 * - Non-AIGF decorators are preserved.
 *
 * Pure: no I/O. Caller is responsible for persistence.
 *
 * @param arch    Architecture to recompute against
 * @param target  File name to record in the decorator's `target` field
 * @param now     Date used for `assessment-date` (parameterised for deterministic testing)
 */
export function recomputeAigfDecorators(
  arch: CalmArchitecture,
  target = 'architecture.calm.json',
  now: Date = new Date(),
): CalmArchitecture {
  const aiNodes = arch.nodes.filter((n) => isAINode(n['node-type']));
  const otherDecorators = (arch.decorators ?? []).filter(
    (d) => d['unique-id'] !== AIGF_DECORATOR_UNIQUE_ID,
  );

  if (aiNodes.length === 0) {
    if (otherDecorators.length === 0) {
      const { decorators: _drop, ...rest } = arch;
      return rest;
    }
    return { ...arch, decorators: otherDecorators };
  }

  const decorator: CalmDecorator = {
    'unique-id': AIGF_DECORATOR_UNIQUE_ID,
    type: AIGF_DECORATOR_TYPE,
    target: [target],
    'applies-to': aiNodes.map((n) => n['unique-id']),
    data: {
      framework: AIGF_FRAMEWORK,
      version: AIGF_VERSION,
      'governance-score': computeGovernanceScore(aiNodes),
      'assessment-date': isoDate(now),
    },
  };

  return { ...arch, decorators: [...otherDecorators, decorator] };
}
