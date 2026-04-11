import type { ComplianceMapping } from '@/lib/agents/compliance-mapper';
import type { RiskAssessment } from '@/lib/agents/risk-scorer';
import type { AnalysisInput } from '@/lib/calm/extractor';
import type { CalmRelationship } from '@/lib/calm/types';
import { generateFingerprint } from './fingerprint';
import type { CompliancePattern } from './types';

/**
 * Extract structural triggers from a CALM relationship.
 */
function getRelationshipTriggers(rel: CalmRelationship, nodes: AnalysisInput['nodes']) {
  const protocols: string[] = [];
  const nodeTypes: string[] = [];
  const relationshipTypes: string[] = [rel['relationship-type']];

  if (rel.protocol) {
    protocols.push(rel.protocol);
  }

  if (rel['relationship-type'] === 'connects') {
    const sourceNode = nodes.find(n => n['unique-id'] === rel.connects.source.node);
    const destNode = nodes.find(n => n['unique-id'] === rel.connects.destination.node);
    if (sourceNode) nodeTypes.push(sourceNode['node-type']);
    if (destNode) nodeTypes.push(destNode['node-type']);
  } else if (rel['relationship-type'] === 'interacts') {
    const actorNode = nodes.find(n => n['unique-id'] === rel.interacts.actor);
    if (actorNode) nodeTypes.push(actorNode['node-type']);
    for (const nid of rel.interacts.nodes) {
      const node = nodes.find(n => n['unique-id'] === nid);
      if (node) nodeTypes.push(node['node-type']);
    }
  } else if (rel['relationship-type'] === 'deployed-in') {
    const container = nodes.find(n => n['unique-id'] === rel['deployed-in'].container);
    if (container) nodeTypes.push(container['node-type']);
    for (const nid of rel['deployed-in'].nodes) {
      const node = nodes.find(n => n['unique-id'] === nid);
      if (node) nodeTypes.push(node['node-type']);
    }
  } else if (rel['relationship-type'] === 'composed-of') {
    const container = nodes.find(n => n['unique-id'] === rel['composed-of'].container);
    if (container) nodeTypes.push(container['node-type']);
  }

  return {
    protocols,
    nodeTypes: [...new Set(nodeTypes)],
    relationshipTypes,
  };
}

/**
 * Extract compliance patterns from analysis results.
 *
 * Scans frameworkMappings for non-compliant/partial findings and gaps,
 * then determines the structural triggers (protocols, node types, etc.)
 * that caused each finding. Returns fingerprinted patterns for deduplication.
 *
 * @param compliance - Compliance mapping from the compliance-mapper agent
 * @param risk - Risk assessment (optional, for enriching severity)
 * @param input - The CALM analysis input
 * @returns Array of new CompliancePattern objects (observationCount=1)
 */
export function extractPatterns(
  compliance: ComplianceMapping,
  risk: RiskAssessment | null,
  input: AnalysisInput,
): CompliancePattern[] {
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const patterns: CompliancePattern[] = [];

  // Build a quick lookup of risk findings by framework for severity enrichment
  const riskFindingsByFramework = new Map<string, typeof risk extends null ? never : NonNullable<typeof risk>['topFindings'][number][]>();
  if (risk) {
    for (const finding of risk.topFindings) {
      const fw = finding.framework || 'unknown';
      if (!riskFindingsByFramework.has(fw)) {
        riskFindingsByFramework.set(fw, []);
      }
      riskFindingsByFramework.get(fw)!.push(finding);
    }
  }

  // Extract from framework mappings (non-compliant and partial)
  for (const mapping of compliance.frameworkMappings) {
    if (mapping.status !== 'non-compliant' && mapping.status !== 'partial') {
      continue;
    }

    // Determine structural triggers by examining the CALM input
    const triggers = {
      protocols: [] as string[],
      nodeTypes: [] as string[],
      relationshipTypes: [] as string[],
      missingControls: [] as string[],
    };

    // Check if this mapping references a CALM control ID
    if (mapping.calmControlId) {
      // Look for nodes that have (or lack) this control
      for (const node of input.nodes) {
        const hasControl = node.controls && mapping.calmControlId in node.controls;
        if (!hasControl) {
          triggers.nodeTypes.push(node['node-type']);
          triggers.missingControls.push(mapping.calmControlId);
        }
      }
    }

    // Extract protocol-based triggers from relationships
    for (const rel of input.relationships) {
      if (rel.protocol) {
        const relTriggers = getRelationshipTriggers(rel, input.nodes);
        triggers.protocols.push(...relTriggers.protocols);
        triggers.nodeTypes.push(...relTriggers.nodeTypes);
        triggers.relationshipTypes.push(...relTriggers.relationshipTypes);
      }
    }

    // Deduplicate trigger arrays
    triggers.protocols = [...new Set(triggers.protocols)];
    triggers.nodeTypes = [...new Set(triggers.nodeTypes)];
    triggers.relationshipTypes = [...new Set(triggers.relationshipTypes)];
    triggers.missingControls = [...new Set(triggers.missingControls)];

    const fingerprint = generateFingerprint(triggers, mapping.framework, mapping.status);

    // Skip if we already extracted a pattern with this fingerprint in this run
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    patterns.push({
      fingerprint,
      description: `${mapping.framework} ${mapping.controlId}: ${mapping.controlName} — ${mapping.status}`,
      framework: mapping.framework,
      status: mapping.status,
      severity: mapping.severity,
      triggers,
      recommendation: mapping.recommendation,
      observationCount: 1,
      confidence: 0,
      firstSeen: now,
      lastSeen: now,
      promoted: false,
    });
  }

  // Extract from gaps (missing controls)
  for (const gap of compliance.gaps) {
    const triggers = {
      protocols: [] as string[],
      nodeTypes: Object.keys(input.metadata.nodeTypes),
      relationshipTypes: [] as string[],
      missingControls: [gap.missingControl],
    };

    const fingerprint = generateFingerprint(triggers, gap.framework, 'non-compliant');

    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    patterns.push({
      fingerprint,
      description: `${gap.framework}: Missing ${gap.missingControl} — ${gap.description}`,
      framework: gap.framework,
      status: 'non-compliant',
      severity: gap.severity,
      triggers,
      recommendation: gap.recommendation,
      observationCount: 1,
      confidence: 0,
      firstSeen: now,
      lastSeen: now,
      promoted: false,
    });
  }

  return patterns;
}
