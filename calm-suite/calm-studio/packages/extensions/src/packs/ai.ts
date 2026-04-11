// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { PackDefinition, PackColor } from '../types.js';
import { aiIcons } from '../icons/ai.js';

const aiColor: PackColor = {
  bg: '#f5f0ff',
  border: '#8b5cf6',
  stroke: '#7c3aed',
  badge: '[AI]',
};

function node(
  typeId: string,
  label: string,
  iconKey: string,
  description: string,
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: aiIcons[iconKey] ?? aiIcons['llm']!,
    color: aiColor,
    description,
  };
}

export const aiPack: PackDefinition = {
  id: 'ai',
  label: 'AI / Agentic',
  version: '1.0.0',
  color: aiColor,
  nodes: [
    node('ai:llm', 'LLM', 'llm', 'Large Language Model inference endpoint'),
    node('ai:agent', 'Agent', 'agent', 'An autonomous AI agent that takes actions'),
    node('ai:orchestrator', 'Orchestrator', 'orchestrator', 'Coordinates multiple agents or pipeline steps'),
    node('ai:vector-store', 'Vector Store', 'vector-store', 'Stores and retrieves vector embeddings for semantic search'),
    node('ai:tool', 'Tool', 'tool', 'A callable function or API exposed to an AI agent'),
    node('ai:memory', 'Memory', 'memory', 'Persistent or working memory for agent context'),
    node('ai:guardrail', 'Guardrail', 'guardrail', 'Safety filter for validating agent inputs and outputs'),
    node('ai:embedding-model', 'Embedding Model', 'embedding-model', 'Converts text into vector embeddings'),
    node('ai:rag-pipeline', 'RAG Pipeline', 'rag-pipeline', 'Retrieval-Augmented Generation processing pipeline'),
    node('ai:prompt-template', 'Prompt Template', 'prompt-template', 'Reusable structured prompt with variable slots'),
    node('ai:api-gateway', 'API Gateway', 'api-gateway', 'Entry point gateway for AI API requests'),
    node('ai:human-in-the-loop', 'Human in the Loop', 'human-in-the-loop', 'Human review or approval step in an AI pipeline'),
    node('ai:knowledge-base', 'Knowledge Base', 'knowledge-base', 'Structured domain knowledge repository for AI'),
    node('ai:eval-monitor', 'Eval Monitor', 'eval-monitor', 'Evaluation and quality monitoring for AI outputs'),
  ],
};
