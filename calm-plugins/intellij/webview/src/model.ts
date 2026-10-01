export interface CalmArchitecture { nodes: Array<Record<string, unknown>>; relationships: Array<Record<string, unknown>>; [key: string]: unknown }

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Guard containment before the upstream parser's recursive traversal.
export function readArchitecture(json: string): CalmArchitecture {
  const value: unknown = JSON.parse(json);
  if (!record(value) || !Array.isArray(value.nodes)) throw new Error('Expected a CALM object with a nodes array.');
  if (value.relationships !== undefined && !Array.isArray(value.relationships)) throw new Error('relationships must be an array.');
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!record(node) || typeof node['unique-id'] !== 'string' || !node['unique-id']) throw new Error('Each node needs a unique-id.');
    if (ids.has(node['unique-id'])) throw new Error(`Duplicate node ID: ${node['unique-id']}`);
    ids.add(node['unique-id']);
  }
  const parents = new Map<string, string>();
  for (const relationship of value.relationships ?? []) {
    if (!record(relationship) || !record(relationship['relationship-type'])) throw new Error('Each relationship needs a relationship-type object.');
    const type = relationship['relationship-type'];
    const containment = type['deployed-in'] ?? type['composed-of'];
    if (containment !== undefined) {
      if (!record(containment) || typeof containment.container !== 'string' || !Array.isArray(containment.nodes)) throw new Error('Containment needs a container and nodes array.');
      if (!ids.has(containment.container)) throw new Error(`Unknown container: ${containment.container}`);
      for (const child of containment.nodes) {
        if (typeof child !== 'string' || !ids.has(child)) throw new Error('Containment references an unknown node.');
        if (parents.has(child) && parents.get(child) !== containment.container) throw new Error(`Node ${child} has multiple containers.`);
        parents.set(child, containment.container);
      }
    }
  }
  for (const id of parents.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current !== undefined) {
      if (visited.has(current)) throw new Error('Containment contains a cycle.');
      visited.add(current);
      current = parents.get(current);
    }
  }
  return { ...value, relationships: value.relationships ?? [] } as CalmArchitecture;
}

