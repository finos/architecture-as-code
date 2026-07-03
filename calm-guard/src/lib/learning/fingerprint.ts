import type { PatternFingerprint, PatternTriggers } from './types';

/**
 * Generate a stable fingerprint from structural compliance triggers.
 *
 * The fingerprint is deterministic: same structural characteristics always produce
 * the same fingerprint, regardless of specific node names or IDs. This enables
 * deduplication of the same compliance issue observed across different analyses.
 *
 * IMPORTANT: missingControls are excluded from the fingerprint because they come
 * from LLM-generated calmControlId values which vary between runs. Including them
 * would create unique fingerprints every run, preventing deduplication.
 *
 * Format: "protocol1,protocol2|nodeType1,nodeType2|relType1|FRAMEWORK|STATUS"
 *
 * @param triggers - Structural trigger conditions
 * @param framework - Compliance framework (e.g., 'PCI-DSS')
 * @param status - Compliance status (e.g., 'non-compliant')
 * @returns Stable fingerprint string
 */
export function generateFingerprint(
  triggers: PatternTriggers,
  framework: string,
  status: string,
): PatternFingerprint {
  const parts = [
    [...triggers.protocols].sort().join(','),
    [...triggers.nodeTypes].sort().join(','),
    [...triggers.relationshipTypes].sort().join(','),
    framework,
    status,
  ];
  return parts.join('|');
}
