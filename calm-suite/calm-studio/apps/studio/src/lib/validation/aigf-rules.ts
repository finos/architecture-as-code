// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * aigf-rules.ts — FINOS AIGF v2.0 validation rules for CalmStudio.
 *
 * IMPORTANT: This file is pure TypeScript. It MUST NOT import from .svelte.ts files.
 * Imports only from @calmstudio/calm-core. Follows the projection.ts precedent
 * (see RESEARCH Pitfall 5).
 *
 * Exports runAIGFRules(arch) which checks a CalmArchitecture for AIGF governance gaps
 * and returns an array of ValidationIssue objects.
 */

import type { CalmArchitecture, CalmNode, ValidationIssue } from '@calmstudio/calm-core';
import { isAINode, AIGF_CONTROL_KEYS } from '@calmstudio/calm-core';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the node has at least one AIGF governance control.
 * Checks against the known AIGF control key set (domain-oriented keys per CALM spec).
 */
function hasAIGFControl(node: CalmNode): boolean {
  if (!node.controls) return false;
  return Object.keys(node.controls).some((key) => AIGF_CONTROL_KEYS.has(key));
}

/**
 * Returns true if the node has a specific control key.
 */
function hasControl(node: CalmNode, controlKey: string): boolean {
  if (!node.controls) return false;
  return Object.prototype.hasOwnProperty.call(node.controls, controlKey);
}

// ─── Rule implementations ────────────────────────────────────────────────────

/**
 * aigf-001 (warning): AI node has no AIGF controls.
 * Every AI node should have at least one AIGF governance control.
 */
function checkAIGF001(arch: CalmArchitecture): ValidationIssue[] {
  return arch.nodes
    .filter((n) => isAINode(n) && !hasAIGFControl(n))
    .map((n): ValidationIssue => ({
      severity: 'warning',
      message: `[aigf-001] AI node "${n.name}" (${n['node-type']}) has no AIGF governance controls. Add at least one governance control.`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-002 (warning): ai:llm missing version pinning (mi-10).
 * LLM nodes must pin the model version to prevent silent capability drift.
 */
function checkAIGF002(arch: CalmArchitecture): ValidationIssue[] {
  return arch.nodes
    .filter((n) => n['node-type'] === 'ai:llm' && !hasControl(n, 'model-version-pinning'))
    .map((n): ValidationIssue => ({
      severity: 'warning',
      message: `[aigf-002] LLM node "${n.name}" is missing model-version-pinning control. Pin model version to prevent capability drift (AIGF mi-10).`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-003 (warning): ai:vector-store missing data governance (mi-6).
 * Vector stores containing embeddings need a data-governance control.
 */
function checkAIGF003(arch: CalmArchitecture): ValidationIssue[] {
  return arch.nodes
    .filter((n) => n['node-type'] === 'ai:vector-store' && !hasControl(n, 'data-governance'))
    .map((n): ValidationIssue => ({
      severity: 'warning',
      message: `[aigf-003] Vector store "${n.name}" is missing data-governance control. Classify embedded data sensitivity (AIGF mi-6).`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-004 (error): ai:agent missing least privilege (mi-18).
 * Agent nodes have elevated capabilities and MUST operate under least-privilege.
 */
function checkAIGF004(arch: CalmArchitecture): ValidationIssue[] {
  return arch.nodes
    .filter((n) => n['node-type'] === 'ai:agent' && !hasControl(n, 'agent-least-privilege'))
    .map((n): ValidationIssue => ({
      severity: 'error',
      message: `[aigf-004] Agent node "${n.name}" is missing agent-least-privilege control. Agents MUST operate with minimum required permissions (AIGF mi-18).`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-005 (error): MCP connection detected but no MCP security control (mi-20).
 * Any relationship with "MCP" in the description requires the source node to have mcp-security.
 */
function checkAIGF005(arch: CalmArchitecture): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map<string, CalmNode>(arch.nodes.map((n) => [n['unique-id'], n]));

  for (const rel of arch.relationships) {
    const hasMCP =
      (rel.description?.toUpperCase().includes('MCP') ?? false);

    if (!hasMCP) continue;

    const sourceNode = nodeMap.get(rel.source);
    if (!sourceNode) continue;

    if (!hasControl(sourceNode, 'mcp-security')) {
      issues.push({
        severity: 'error',
        message: `[aigf-005] Relationship "${rel['unique-id']}" uses MCP protocol but source node "${sourceNode.name}" is missing mcp-security control (AIGF mi-20).`,
        nodeId: sourceNode['unique-id'],
        relationshipId: rel['unique-id'],
      });
    }
  }

  return issues;
}

/**
 * aigf-006 (warning): Multi-agent pattern (>1 ai:agent) but no isolation control (mi-22).
 * Multi-agent architectures need isolation boundaries to prevent cascading failures.
 */
function checkAIGF006(arch: CalmArchitecture): ValidationIssue[] {
  const agents = arch.nodes.filter((n) => n['node-type'] === 'ai:agent');
  if (agents.length <= 1) return [];

  const agentsWithoutIsolation = agents.filter((n) => !hasControl(n, 'agent-isolation'));
  if (agentsWithoutIsolation.length === 0) return [];

  // Report one issue per agent lacking isolation
  return agentsWithoutIsolation.map((n): ValidationIssue => ({
    severity: 'warning',
    message: `[aigf-006] Multi-agent architecture detected: agent "${n.name}" is missing agent-isolation control. Isolate agents to prevent cascading failures (AIGF mi-22).`,
    nodeId: n['unique-id'],
  }));
}

/**
 * aigf-007 (info): ai:rag-pipeline — consider citation traceability (mi-13).
 * RAG pipelines should maintain source attribution for generated responses.
 */
function checkAIGF007(arch: CalmArchitecture): ValidationIssue[] {
  return arch.nodes
    .filter((n) => n['node-type'] === 'ai:rag-pipeline' && !hasControl(n, 'citations-traceability'))
    .map((n): ValidationIssue => ({
      severity: 'info',
      message: `[aigf-007] RAG pipeline "${n.name}" could benefit from citations-traceability control for source attribution (AIGF mi-13).`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-008 (warning): AI data store missing encryption at rest (mi-14).
 * Vector stores and memory nodes holding AI data must encrypt at rest.
 */
function checkAIGF008(arch: CalmArchitecture): ValidationIssue[] {
  const AI_DATA_STORE_TYPES = new Set(['ai:vector-store', 'ai:memory']);
  return arch.nodes
    .filter((n) => AI_DATA_STORE_TYPES.has(n['node-type']) && !hasControl(n, 'data-encryption'))
    .map((n): ValidationIssue => ({
      severity: 'warning',
      message: `[aigf-008] AI data store "${n.name}" (${n['node-type']}) is missing data-encryption control. Encrypt AI data at rest (AIGF mi-14).`,
      nodeId: n['unique-id'],
    }));
}

/**
 * aigf-009 (warning): ai:agent connected to ai:tool without tool chain validation (mi-19).
 * Agent-to-tool connections must include tool chain validation to prevent tool abuse.
 */
function checkAIGF009(arch: CalmArchitecture): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeMap = new Map<string, CalmNode>(arch.nodes.map((n) => [n['unique-id'], n]));

  const toolIds = new Set(
    arch.nodes.filter((n) => n['node-type'] === 'ai:tool').map((n) => n['unique-id'])
  );

  for (const rel of arch.relationships) {
    const sourceNode = nodeMap.get(rel.source);
    if (!sourceNode || sourceNode['node-type'] !== 'ai:agent') continue;
    if (!toolIds.has(rel.destination)) continue;

    if (!hasControl(sourceNode, 'tool-chain-validation')) {
      issues.push({
        severity: 'warning',
        message: `[aigf-009] Agent "${sourceNode.name}" connects to ai:tool but is missing tool-chain-validation control (AIGF mi-19).`,
        nodeId: sourceNode['unique-id'],
        relationshipId: rel['unique-id'],
      });
    }
  }

  return issues;
}

/**
 * aigf-010 (info): Architecture governance score report.
 * Computes an overall AIGF governance score based on AI nodes with controls.
 */
function checkAIGF010(arch: CalmArchitecture): ValidationIssue[] {
  const aiNodes = arch.nodes.filter((n) => isAINode(n));

  if (aiNodes.length === 0) {
    return [{
      severity: 'info',
      message: '[aigf-010] No AI nodes detected. Governance score: N/A (no AI components).',
    }];
  }

  const nodesWithAIGFControls = aiNodes.filter((n) => hasAIGFControl(n));
  const score = Math.round((nodesWithAIGFControls.length / aiNodes.length) * 100);

  return [{
    severity: 'info',
    message: `[aigf-010] AIGF Governance Score: ${score}% — ${nodesWithAIGFControls.length}/${aiNodes.length} AI nodes have AIGF controls.`,
  }];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs all 10 AIGF governance rules against the given CalmArchitecture.
 * Returns an array of ValidationIssue objects. Empty array if no AI nodes
 * and no governance gaps detected (except aigf-010 info which always fires).
 */
export function runAIGFRules(arch: CalmArchitecture): ValidationIssue[] {
  return [
    ...checkAIGF001(arch),
    ...checkAIGF002(arch),
    ...checkAIGF003(arch),
    ...checkAIGF004(arch),
    ...checkAIGF005(arch),
    ...checkAIGF006(arch),
    ...checkAIGF007(arch),
    ...checkAIGF008(arch),
    ...checkAIGF009(arch),
    ...checkAIGF010(arch),
  ];
}
