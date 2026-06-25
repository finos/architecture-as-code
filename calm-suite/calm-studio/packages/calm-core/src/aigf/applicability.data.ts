// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Node-type → recommended AIGF guideline ids (finos-air), pre-resolved from the
 * AIGF node-type mappings. The built-in applicability overlay: which guidelines
 * are recommended for an ai:* node type. Independent of the legacy catalogue.
 */
export const AIGF_NODE_GUIDELINES: Record<string, string[]> = {
  "ai:llm": [
    "AIR-PREV-010",
    "AIR-PREV-003",
    "AIR-DET-001",
    "AIR-DET-015"
  ],
  "ai:agent": [
    "AIR-PREV-018",
    "AIR-DET-021",
    "AIR-PREV-022"
  ],
  "ai:orchestrator": [
    "AIR-PREV-022",
    "AIR-PREV-019",
    "AIR-DET-021"
  ],
  "ai:vector-store": [
    "AIR-PREV-002",
    "AIR-PREV-012",
    "AIR-PREV-014",
    "AIR-PREV-006"
  ],
  "ai:tool": [
    "AIR-PREV-019"
  ],
  "ai:memory": [
    "AIR-PREV-023",
    "AIR-PREV-014"
  ],
  "ai:rag-pipeline": [
    "AIR-DET-013",
    "AIR-PREV-002",
    "AIR-PREV-006"
  ],
  "ai:knowledge-base": [
    "AIR-PREV-006",
    "AIR-DET-016"
  ],
  "ai:embedding-model": [
    "AIR-PREV-010",
    "AIR-PREV-005"
  ],
  "ai:api-gateway": [
    "AIR-PREV-003",
    "AIR-PREV-017",
    "AIR-PREV-008"
  ],
  "ai:mcp-server": [
    "AIR-PREV-019",
    "AIR-DET-021"
  ]
};
