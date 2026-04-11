// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture, CalmNode, CalmRelationship } from '../src/index.js';

/**
 * Create a single CALM node with sensible defaults.
 * Override any field via the optional overrides parameter.
 */
export function createNode(overrides?: Partial<CalmNode>): CalmNode {
  return {
    'unique-id': 'node-1',
    'node-type': 'service',
    name: 'Test Service',
    description: 'A test service',
    ...overrides,
  };
}

/**
 * Create a single CALM relationship with sensible defaults.
 * Override any field via the optional overrides parameter.
 */
export function createRelationship(overrides?: Partial<CalmRelationship>): CalmRelationship {
  return {
    'unique-id': 'rel-1',
    'relationship-type': 'connects',
    source: 'node-1',
    destination: 'node-2',
    ...overrides,
  };
}

/**
 * Create a minimal CALM architecture:
 * - 2 nodes: an API service and a database
 * - 1 relationship: HTTPS connection from API to DB
 */
export function createMinimalArch(overrides?: Partial<CalmArchitecture>): CalmArchitecture {
  const base: CalmArchitecture = {
    nodes: [
      {
        'unique-id': 'api-service',
        'node-type': 'service',
        name: 'API Service',
        description: 'The main API service',
      },
      {
        'unique-id': 'main-db',
        'node-type': 'database',
        name: 'Main DB',
        description: 'The primary database',
      },
    ],
    relationships: [
      {
        'unique-id': 'api-to-db',
        'relationship-type': 'connects',
        source: 'api-service',
        destination: 'main-db',
        protocol: 'HTTPS',
        description: 'API connects to database',
      },
    ],
  };
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Create a FluxNova platform architecture:
 * - Platform container node (fluxnova:platform)
 * - Engine node (fluxnova:engine)
 * - REST API node (fluxnova:rest-api) with Confidential data classification
 * - Cockpit UI node (fluxnova:cockpit)
 * - deployed-in relationships from engine, rest-api, cockpit into platform
 */
export function createFluxNovaArch(overrides?: Partial<CalmArchitecture>): CalmArchitecture {
  const base: CalmArchitecture = {
    nodes: [
      {
        'unique-id': 'fluxnova-platform',
        'node-type': 'fluxnova:platform',
        name: 'FluxNova Platform',
        description: 'The FluxNova BPM platform container',
      },
      {
        'unique-id': 'fluxnova-engine',
        'node-type': 'fluxnova:engine',
        name: 'FluxNova Engine',
        description: 'Core workflow execution engine',
      },
      {
        'unique-id': 'fluxnova-rest-api',
        'node-type': 'fluxnova:rest-api',
        name: 'FluxNova REST API',
        description: 'Public REST API gateway',
        'data-classification': 'Confidential',
      },
      {
        'unique-id': 'fluxnova-cockpit',
        'node-type': 'fluxnova:cockpit',
        name: 'FluxNova Cockpit',
        description: 'Operational monitoring dashboard',
      },
    ],
    relationships: [
      {
        'unique-id': 'engine-in-platform',
        'relationship-type': 'deployed-in',
        source: 'fluxnova-engine',
        destination: 'fluxnova-platform',
        description: 'Engine deployed in FluxNova platform',
      },
      {
        'unique-id': 'rest-api-in-platform',
        'relationship-type': 'deployed-in',
        source: 'fluxnova-rest-api',
        destination: 'fluxnova-platform',
        description: 'REST API deployed in FluxNova platform',
      },
      {
        'unique-id': 'cockpit-in-platform',
        'relationship-type': 'deployed-in',
        source: 'fluxnova-cockpit',
        destination: 'fluxnova-platform',
        description: 'Cockpit deployed in FluxNova platform',
      },
    ],
  };
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Create an AI Governance architecture:
 * - LLM node (ai:llm) with security domain control
 * - Agent node (ai:agent)
 * - Orchestrator node (ai:orchestrator)
 * - Vector store node (ai:vector-store)
 * - interacts relationships forming the AI pipeline
 */
export function createAIGovernanceArch(overrides?: Partial<CalmArchitecture>): CalmArchitecture {
  const base: CalmArchitecture = {
    nodes: [
      {
        'unique-id': 'ai-orchestrator',
        'node-type': 'ai:orchestrator',
        name: 'AI Orchestrator',
        description: 'Coordinates AI agents and workflows',
      },
      {
        'unique-id': 'ai-agent',
        'node-type': 'ai:agent',
        name: 'AI Agent',
        description: 'Autonomous task execution agent',
      },
      {
        'unique-id': 'ai-llm',
        'node-type': 'ai:llm',
        name: 'Language Model',
        description: 'Large language model inference endpoint',
        controls: {
          'security-domain': {
            description: 'LLM security domain control',
            requirements: [
              {
                'requirement-url': 'https://finos.org/aigf/controls/security-domain',
              },
            ],
          },
        },
      },
      {
        'unique-id': 'ai-vector-store',
        'node-type': 'ai:vector-store',
        name: 'Vector Store',
        description: 'Embedding storage and retrieval',
      },
    ],
    relationships: [
      {
        'unique-id': 'orchestrator-to-agent',
        'relationship-type': 'interacts',
        source: 'ai-orchestrator',
        destination: 'ai-agent',
        description: 'Orchestrator directs agent tasks',
      },
      {
        'unique-id': 'agent-to-llm',
        'relationship-type': 'interacts',
        source: 'ai-agent',
        destination: 'ai-llm',
        description: 'Agent calls LLM for inference',
      },
      {
        'unique-id': 'agent-to-vector-store',
        'relationship-type': 'interacts',
        source: 'ai-agent',
        destination: 'ai-vector-store',
        description: 'Agent retrieves context from vector store',
      },
    ],
  };
  return {
    ...base,
    ...overrides,
  };
}
