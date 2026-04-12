// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Node-type-to-AIGF-risk mappings and lookup functions.
 * Maps AI pack node types to applicable FINOS AIGF v2.0 risks and recommended mitigations.
 * Used for design-time governance in CalmStudio — surfaces relevant risks when an AI node
 * is added to the architecture.
 */

import type { AIGFRisk, AIGFMitigation, AIGFNodeRiskMapping } from './types.js';
import { aigfRisks, aigfMitigations } from './catalogue.js';

/**
 * Mapping table: AI node type -> applicable risk IDs + recommended mitigation IDs.
 * Source: PRD B1.3 table from docs/REQ_fluxnova_aigf_integration.md
 */
export const aigfNodeRiskMappings: AIGFNodeRiskMapping[] = [
  {
    nodeTypePattern: 'ai:llm',
    applicableRisks: ['AIR-OP-004', 'AIR-OP-005', 'AIR-OP-006', 'AIR-RC-001'],
    recommendedMitigations: ['mi-10', 'mi-3', 'mi-1', 'mi-15'],
  },
  {
    nodeTypePattern: 'ai:agent',
    applicableRisks: ['AIR-SEC-024', 'AIR-OP-018', 'AIR-OP-028'],
    recommendedMitigations: ['mi-18', 'mi-21', 'mi-22'],
  },
  {
    nodeTypePattern: 'ai:orchestrator',
    applicableRisks: ['AIR-OP-028', 'AIR-SEC-025'],
    recommendedMitigations: ['mi-22', 'mi-19', 'mi-21'],
  },
  {
    nodeTypePattern: 'ai:vector-store',
    applicableRisks: ['AIR-SEC-002', 'AIR-SEC-009'],
    recommendedMitigations: ['mi-2', 'mi-12', 'mi-14', 'mi-6'],
  },
  {
    nodeTypePattern: 'ai:tool',
    applicableRisks: ['AIR-SEC-025'],
    recommendedMitigations: ['mi-19'],
  },
  {
    nodeTypePattern: 'ai:memory',
    applicableRisks: ['AIR-SEC-027'],
    recommendedMitigations: ['mi-23', 'mi-14'],
  },
  {
    nodeTypePattern: 'ai:guardrail',
    applicableRisks: [],
    recommendedMitigations: [],
  },
  {
    nodeTypePattern: 'ai:rag-pipeline',
    applicableRisks: ['AIR-OP-004', 'AIR-SEC-002'],
    recommendedMitigations: ['mi-13', 'mi-2', 'mi-6'],
  },
  {
    nodeTypePattern: 'ai:knowledge-base',
    applicableRisks: ['AIR-SEC-009', 'AIR-OP-019'],
    recommendedMitigations: ['mi-6', 'mi-16'],
  },
  {
    nodeTypePattern: 'ai:embedding-model',
    applicableRisks: ['AIR-SEC-008', 'AIR-OP-005'],
    recommendedMitigations: ['mi-10', 'mi-5'],
  },
  {
    nodeTypePattern: 'ai:api-gateway',
    applicableRisks: ['AIR-SEC-010', 'AIR-OP-007'],
    recommendedMitigations: ['mi-3', 'mi-17', 'mi-8'],
  },
  {
    nodeTypePattern: 'ai:human-in-the-loop',
    applicableRisks: [],
    recommendedMitigations: [],
  },
  {
    nodeTypePattern: 'ai:eval-monitor',
    applicableRisks: [],
    recommendedMitigations: [],
  },
];

/**
 * Returns true if the given node (or node-type string) is an AI node.
 * AI nodes have a node-type that starts with 'ai:'.
 */
export function isAINode(nodeOrType: { 'node-type': string } | string): boolean {
  const nodeType = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType['node-type'];
  return nodeType.startsWith('ai:');
}

/**
 * Returns the applicable AIGF risks and recommended mitigations for a given node type.
 * Returns empty arrays for non-AI nodes or AI node types with no mapped risks
 * (e.g. ai:guardrail, ai:human-in-the-loop, ai:eval-monitor — these ARE mitigations).
 */
export function getAIGFForNodeType(nodeType: string): {
  risks: AIGFRisk[];
  mitigations: AIGFMitigation[];
} {
  const mapping = aigfNodeRiskMappings.find((m) => m.nodeTypePattern === nodeType);

  if (!mapping) {
    return { risks: [], mitigations: [] };
  }

  const risks = mapping.applicableRisks
    .map((id) => aigfRisks.find((r) => r.id === id))
    .filter((r): r is AIGFRisk => r !== undefined);

  const mitigations = mapping.recommendedMitigations
    .map((id) => aigfMitigations.find((m) => m.id === id))
    .filter((m): m is AIGFMitigation => m !== undefined);

  return { risks, mitigations };
}
