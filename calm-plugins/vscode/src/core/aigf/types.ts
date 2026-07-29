// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * AIGF Risk types: Operational, Security, Regulatory/Compliance
 */
export type AIGFRiskType = 'OP' | 'SEC' | 'RC';

/**
 * AIGF Mitigation types: Preventive, Detective
 */
export type AIGFMitigationType = 'PREV' | 'DET';

/**
 * External framework cross-references for an AIGF risk or mitigation.
 * All fields are optional string arrays — frameworks may not cover every item.
 */
export interface AIGFExternalRefs {
  owaspLlm?: string[];
  owaspMl?: string[];
  nistAi600?: string[];
  ffiec?: string[];
  euAiAct?: string[];
  nistSp80053r5?: string[];
  iso42001?: string[];
  mitreAtlas?: string[];
}

/**
 * A single AI Governance Framework risk.
 * Source: docs/AIGF_CATALOGUE.json — FINOS AIGF v2.0
 */
export interface AIGFRisk {
  id: string;
  sequence: number;
  title: string;
  type: AIGFRiskType;
  description: string;
  externalRefs: AIGFExternalRefs;
  relatedRisks: string[];
}

/**
 * A single AI Governance Framework mitigation.
 * Source: docs/AIGF_CATALOGUE.json — FINOS AIGF v2.0
 */
export interface AIGFMitigation {
  id: string;
  sequence: number;
  title: string;
  type: AIGFMitigationType;
  description: string;
  externalRefs: AIGFExternalRefs;
  mitigates: string[];
  relatedMitigations: string[];
  calmControlKey: string;
  airId: string;
}

/**
 * Maps a node type pattern to applicable AIGF risks and recommended mitigations.
 * Used for design-time governance — surfaces relevant risks when an AI node is added
 * to the architecture.
 */
export interface AIGFNodeRiskMapping {
  nodeTypePattern: string;
  applicableRisks: string[];
  recommendedMitigations: string[];
}
