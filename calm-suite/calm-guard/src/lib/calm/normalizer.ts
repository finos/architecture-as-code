/**
 * CALM Version Normalizer
 *
 * Detects CALM document versions (v1.0, v1.1, v1.2) and normalizes
 * v1.0 documents to v1.1-compatible shape before Zod parsing.
 *
 * Version detection priority:
 *   1. v1.0 — `calmSchemaVersion` field present OR legacy node types detected
 *   2. v1.2 — `adrs`, `decorators`, or `timelines` fields present
 *   3. v1.1 — default fallback
 */

export type CalmVersion = '1.0' | '1.1' | '1.2';

/**
 * Maps v1.0 legacy node types to v1.1 canonical node types.
 * Unknown types not in the v1.1 enum default to 'service' (lenient).
 */
const NODE_TYPE_MAP: Record<string, string> = {
  apigateway: 'service',
  'api-gateway': 'service',
  microservice: 'service',
  lambda: 'service',
  queue: 'service',
  cache: 'database',
  relational: 'database',
};

/**
 * The complete set of valid v1.1 node types.
 */
const VALID_V11_NODE_TYPES = new Set([
  'actor',
  'ecosystem',
  'system',
  'service',
  'database',
  'network',
  'ldap',
  'webclient',
  'data-asset',
]);

/**
 * Maps v1.0 legacy relationship types to v1.1 canonical types.
 * Unknown types default to 'connects' (lenient).
 */
const RELATIONSHIP_TYPE_MAP: Record<string, string> = {
  uses: 'connects',
  calls: 'connects',
};

/**
 * Type guard: checks if value is a plain object (not array, null, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks whether an array of raw nodes contains any v1.0 legacy node type.
 * Used as fallback detection when `calmSchemaVersion` is absent.
 */
function hasLegacyNodeTypes(nodes: unknown[]): boolean {
  for (const node of nodes) {
    if (!isPlainObject(node)) continue;
    const type = node['type'];
    if (typeof type === 'string' && NODE_TYPE_MAP[type] !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Detects the CALM version from a raw (un-parsed) JSON document.
 *
 * Detection priority:
 *   1. v1.0 — `calmSchemaVersion` present OR nodes contain legacy types
 *   2. v1.2 — `adrs`, `decorators`, or `timelines` present
 *   3. v1.1 — default
 *
 * @param raw - Unknown value (the parsed JSON before schema validation)
 * @returns Detected CALM version
 */
export function detectCalmVersion(raw: unknown): CalmVersion {
  if (!isPlainObject(raw)) {
    return '1.1';
  }

  // v1.0 check: explicit schema version field
  if ('calmSchemaVersion' in raw) {
    return '1.0';
  }

  // v1.0 check: legacy node types in nodes array
  if (Array.isArray(raw['nodes']) && hasLegacyNodeTypes(raw['nodes'])) {
    return '1.0';
  }

  // v1.2 check: v1.2-specific fields
  if ('adrs' in raw || 'decorators' in raw || 'timelines' in raw) {
    return '1.2';
  }

  // Default: v1.1
  return '1.1';
}

/**
 * Normalizes a raw CALM node from v1.0 format to v1.1-compatible shape.
 *
 * Transformations:
 * - `type` -> `node-type` (mapped via NODE_TYPE_MAP; unknown types become 'service')
 * - `name` -> `unique-id` (used as fallback when no unique-id is present)
 * - `metadata.description` -> `description` (top-level description)
 *
 * @param rawNode - Raw v1.0 node object
 * @param index - Node index (for generated IDs if name is also absent)
 * @returns Normalized node compatible with v1.1 schema
 */
function normalizeV10Node(rawNode: unknown, index: number): Record<string, unknown> {
  if (!isPlainObject(rawNode)) {
    return { 'unique-id': `node-${index}`, 'node-type': 'service', name: `Node ${index}`, description: '' };
  }

  const node = { ...rawNode };

  // Map type -> node-type
  if (typeof node['type'] === 'string') {
    const mappedType = NODE_TYPE_MAP[node['type']];
    node['node-type'] = VALID_V11_NODE_TYPES.has(mappedType ?? node['type'])
      ? (mappedType ?? node['type'])
      : 'service'; // lenient fallback
    delete node['type'];
  } else if (!('node-type' in node)) {
    node['node-type'] = 'service';
  }

  // Promote name -> unique-id if unique-id is absent
  if (!('unique-id' in node) && typeof node['name'] === 'string') {
    node['unique-id'] = node['name'];
  } else if (!('unique-id' in node)) {
    node['unique-id'] = `node-${index}`;
  }

  // Promote metadata.description -> description if description is absent
  if (!('description' in node) && isPlainObject(node['metadata'])) {
    const meta = node['metadata'];
    if (typeof meta['description'] === 'string') {
      node['description'] = meta['description'];
    }
  }

  // Ensure description is present
  if (!('description' in node)) {
    node['description'] = (node['name'] as string | undefined) ?? '';
  }

  return node;
}

/**
 * Normalizes a raw CALM relationship from v1.0 format to v1.1-compatible shape.
 *
 * Transformations:
 * - `{ from, to, type: 'uses' }` -> `{ relationship-type: 'connects', connects: { source, destination } }`
 * - Generates `unique-id` as `rel-{index}` if not present
 *
 * @param rawRel - Raw v1.0 relationship object
 * @param index - Relationship index for generated IDs
 * @returns Normalized relationship compatible with v1.1 schema
 */
function normalizeV10Relationship(rawRel: unknown, index: number): Record<string, unknown> {
  if (!isPlainObject(rawRel)) {
    return {
      'unique-id': `rel-${index}`,
      'relationship-type': 'connects',
      connects: { source: { node: '' }, destination: { node: '' } },
    };
  }

  const rel: Record<string, unknown> = {};

  // Assign unique-id
  rel['unique-id'] = typeof rawRel['unique-id'] === 'string' ? rawRel['unique-id'] : `rel-${index}`;

  // Determine relationship-type
  const rawType = rawRel['type'];
  let relType: string;
  if (typeof rawType === 'string') {
    relType = RELATIONSHIP_TYPE_MAP[rawType] ?? 'connects';
  } else if (typeof rawRel['relationship-type'] === 'string') {
    relType = rawRel['relationship-type'];
  } else {
    relType = 'connects';
  }
  rel['relationship-type'] = relType;

  // Convert { from, to } to connects structure — but preserve existing connects if already normalized
  if (relType === 'connects') {
    if (isPlainObject(rawRel['connects'])) {
      // Already normalized — preserve existing connects structure
      rel['connects'] = rawRel['connects'];
    } else {
      const fromNode = typeof rawRel['from'] === 'string' ? rawRel['from'] : '';
      const toNode = typeof rawRel['to'] === 'string' ? rawRel['to'] : '';
      rel['connects'] = {
        source: { node: fromNode },
        destination: { node: toNode },
      };
    }
  } else {
    // Preserve other fields for non-connects types
    for (const key of Object.keys(rawRel)) {
      if (key !== 'type' && key !== 'from' && key !== 'to' && key !== 'unique-id') {
        rel[key] = rawRel[key];
      }
    }
  }

  // Preserve optional fields
  if (rawRel['description'] !== undefined) rel['description'] = rawRel['description'];
  if (rawRel['protocol'] !== undefined) rel['protocol'] = rawRel['protocol'];
  if (rawRel['controls'] !== undefined) rel['controls'] = rawRel['controls'];
  if (rawRel['metadata'] !== undefined) rel['metadata'] = rawRel['metadata'];

  return rel;
}

/**
 * Normalizes an entire v1.0 CALM document to v1.1-compatible shape.
 *
 * @param raw - Raw v1.0 document object
 * @returns Normalized document object ready for Zod parsing
 */
function normalizeV10(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...raw };

  // Strip v1.0-only fields that would re-trigger version detection on subsequent parses
  delete result['calmSchemaVersion'];

  // Normalize nodes
  if (Array.isArray(raw['nodes'])) {
    result['nodes'] = raw['nodes'].map((node, i) => normalizeV10Node(node, i));
  }

  // Normalize relationships
  if (Array.isArray(raw['relationships'])) {
    result['relationships'] = raw['relationships'].map((rel, i) => normalizeV10Relationship(rel, i));
  }

  return result;
}

/**
 * Normalizes a raw CALM document based on its detected version.
 *
 * - v1.1: returned unchanged (pass-through)
 * - v1.2: returned unchanged (extra fields already accepted by schema)
 * - v1.0: transformed to v1.1-compatible shape
 *
 * @param raw - Raw document value (unknown shape)
 * @param version - Pre-detected CALM version (from `detectCalmVersion`)
 * @returns Normalized document (or original if no normalization needed)
 */
export function normalizeCalmDocument(raw: unknown, version: CalmVersion): unknown {
  if (version === '1.1' || version === '1.2') {
    return raw; // Pass-through — no normalization needed
  }

  // v1.0: apply normalization
  if (!isPlainObject(raw)) {
    return raw;
  }

  return normalizeV10(raw);
}
