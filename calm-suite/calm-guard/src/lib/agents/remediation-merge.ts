import type { CalmDocument, CalmNode, CalmRelationship, Protocol } from '@/lib/calm/types';
import type { ControlDefinition } from '@/lib/calm/types';
import type { CalmRemediationOutput } from './calm-remediator';

/**
 * Merge controls: start with original, overlay new controls from remediation.
 * Never removes existing controls — only adds.
 */
function mergeControls(
  original: Record<string, ControlDefinition> | undefined,
  remediated: Record<string, ControlDefinition> | undefined,
): Record<string, ControlDefinition> | undefined {
  if (!original && !remediated) return undefined;

  const merged: Record<string, ControlDefinition> = {};

  // Start with all original controls
  if (original) {
    for (const [key, value] of Object.entries(original)) {
      merged[key] = value;
    }
  }

  // Overlay new controls from remediation (won't overwrite existing)
  if (remediated) {
    for (const [key, value] of Object.entries(remediated)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge a remediated node with its original, preserving existing controls.
 */
function mergeNode(original: CalmNode, remediated: CalmNode | undefined): CalmNode {
  if (!remediated) return original;

  return {
    ...original,
    // Preserve new fields the LLM added (data-classification, etc.)
    ...remediated,
    // But always merge controls — never replace
    controls: mergeControls(original.controls, remediated.controls),
  };
}

/**
 * Merge a remediated relationship with its original, preserving controls
 * and keeping protocol upgrades.
 */
function mergeRelationship(
  original: CalmRelationship,
  remediated: CalmRelationship | undefined,
): CalmRelationship {
  if (!remediated) return original;

  // Start with original as base, then apply remediated changes
  const merged = {
    ...original,
    ...remediated,
    // Merge controls — never replace
    controls: mergeControls(original.controls, remediated.controls),
  };

  return merged as CalmRelationship;
}

/**
 * Merge LLM-generated remediated CALM document with the original.
 *
 * LLMs are unreliable at faithfully reproducing large JSON documents.
 * They tend to strip existing controls, drop nodes, and simplify structures.
 *
 * This function ensures:
 * - All original controls are preserved (never removed)
 * - New controls from remediation are added
 * - Protocol upgrades from remediation are kept
 * - Nodes/relationships dropped by the LLM are recovered from the original
 * - New fields (data-classification, etc.) from remediation are preserved
 *
 * @param original - The original CALM document before remediation
 * @param remediated - The LLM-generated remediated document
 * @returns Merged document with all original content plus remediation additions
 */
export function mergeRemediatedCalm(
  original: CalmDocument,
  remediated: CalmDocument,
): CalmDocument {
  // Build lookup maps for remediated entities
  const remediatedNodeMap = new Map<string, CalmNode>();
  for (const node of remediated.nodes) {
    remediatedNodeMap.set(node['unique-id'], node);
  }

  const remediatedRelMap = new Map<string, CalmRelationship>();
  for (const rel of remediated.relationships) {
    remediatedRelMap.set(rel['unique-id'], rel);
  }

  // Merge nodes: start from original, overlay remediation
  const mergedNodes = original.nodes.map((origNode) => {
    const remNode = remediatedNodeMap.get(origNode['unique-id']);
    return mergeNode(origNode, remNode);
  });

  // Add any new nodes the LLM created that weren't in the original
  for (const [id, node] of remediatedNodeMap) {
    if (!original.nodes.some(n => n['unique-id'] === id)) {
      mergedNodes.push(node);
    }
  }

  // Merge relationships: start from original, overlay remediation
  const mergedRelationships = original.relationships.map((origRel) => {
    const remRel = remediatedRelMap.get(origRel['unique-id']);
    return mergeRelationship(origRel, remRel);
  });

  // Add any new relationships the LLM created
  for (const [id, rel] of remediatedRelMap) {
    if (!original.relationships.some(r => r['unique-id'] === id)) {
      mergedRelationships.push(rel);
    }
  }

  // Merge top-level controls
  const mergedTopControls = mergeControls(original.controls, remediated.controls);

  return {
    ...original,
    nodes: mergedNodes,
    relationships: mergedRelationships,
    controls: mergedTopControls,
    // Preserve flows from original (LLM shouldn't touch these)
    flows: original.flows,
  };
}

/**
 * Protocol security strength ordering.
 * Higher index = more secure. Used to prevent protocol downgrades.
 */
const PROTOCOL_STRENGTH: Record<string, number> = {
  HTTP: 0,
  FTP: 0,
  TCP: 1,
  LDAP: 1,
  JDBC: 1,
  AMQP: 2,
  WebSocket: 2,
  SocketIO: 2,
  SFTP: 3,
  HTTPS: 4,
  TLS: 4,
  mTLS: 5,
};

/**
 * Apply structured changes from the LLM's changes[] array to the original CALM document.
 *
 * LLMs reliably identify compliance gaps (the changes[] array is accurate) but fail
 * to embed 30+ new control objects into a large JSON document. This function uses
 * the changes as deterministic instructions to programmatically patch the original.
 *
 * For each change:
 * - control-added: Adds a control entry to the target node/relationship
 * - protocol-upgrade: Upgrades the protocol on the target relationship (never downgrades)
 *
 * @param original - The original unmodified CALM document
 * @param changes - The structured changes array from the LLM
 * @returns A new CALM document with all changes applied
 */
export function applyChangesToCalm(
  original: CalmDocument,
  changes: CalmRemediationOutput['changes'],
): CalmDocument {
  // Deep clone to avoid mutation
  const doc: CalmDocument = JSON.parse(JSON.stringify(original));

  // Build lookup maps for fast access
  const nodeMap = new Map<string, CalmNode>();
  for (const node of doc.nodes) {
    nodeMap.set(node['unique-id'], node);
  }

  const relMap = new Map<string, CalmRelationship>();
  for (const rel of doc.relationships) {
    relMap.set(rel['unique-id'], rel);
  }

  for (const change of changes) {
    const { nodeOrRelationshipId, changeType } = change;

    if (changeType === 'control-added') {
      // The 'after' field contains the control key (e.g. 'pci-dss-req-8-4-2-mfa')
      // The 'rationale' serves as the control description
      const controlKey = change.after;
      const controlDef: ControlDefinition = {
        description: change.rationale,
      };

      // Try node first, then relationship, then top-level
      const node = nodeMap.get(nodeOrRelationshipId);
      if (node) {
        if (!node.controls) node.controls = {};
        if (!(controlKey in node.controls)) {
          node.controls[controlKey] = controlDef;
        }
        continue;
      }

      const rel = relMap.get(nodeOrRelationshipId);
      if (rel) {
        if (!rel.controls) rel.controls = {};
        if (!(controlKey in rel.controls)) {
          rel.controls[controlKey] = controlDef;
        }
        continue;
      }

      // Fallback: add to top-level controls (e.g. 'remediatedCalm' or unknown ids)
      if (!doc.controls) doc.controls = {};
      if (!(controlKey in doc.controls)) {
        doc.controls[controlKey] = controlDef;
      }
    } else if (changeType === 'protocol-upgrade') {
      const rel = relMap.get(nodeOrRelationshipId);
      if (!rel || !rel.protocol) continue;

      const currentStrength = PROTOCOL_STRENGTH[rel.protocol] ?? 0;
      const newStrength = PROTOCOL_STRENGTH[change.after] ?? 0;

      // Only upgrade, never downgrade
      if (newStrength > currentStrength) {
        rel.protocol = change.after as Protocol;
      }
    }
  }

  return doc;
}
