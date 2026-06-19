import type { Badge, BadgeAdapter, Severity } from '../types.js';
import type { CalmDecorator, CalmNode, CalmRelationship, CalmArchitecture } from '../../../types.js';

const VALID_SEVERITY: ReadonlySet<Severity> = new Set(['low', 'medium', 'high', 'critical', 'unknown']);

export function severityFromDecorator(d: CalmDecorator): Severity {
  const explicit = d.data?.severity;
  if (typeof explicit === 'string' && VALID_SEVERITY.has(explicit as Severity)) return explicit as Severity;
  const legacy = d.data?.['risk-level'];
  if (typeof legacy === 'string' && VALID_SEVERITY.has(legacy as Severity)) return legacy as Severity;
  if (d.type === 'threat') return 'high';
  return 'unknown';
}

function toBadge(d: CalmDecorator): Badge {
  return {
    id: d['unique-id'],
    source: 'decorators',
    kind: d.type === 'threat' ? 'tint' : 'icon',
    severity: severityFromDecorator(d),
    label: typeof d.data?.name === 'string' ? d.data.name : d['unique-id'],
    data: { decoratorType: d.type, ...(d.data ?? {}) },
  };
}

function emit(
  decorators: CalmDecorator[] | undefined,
  context: 'node' | 'edge',
): Badge[] {
  if (!Array.isArray(decorators)) return [];
  const out: Badge[] = [];
  for (const d of decorators) {
    if (!d || typeof d !== 'object' || !d['unique-id'] || !d.type) {
      console.warn(`[decoratorsAdapter] skipping malformed ${context} decorator`, d);
      continue;
    }
    out.push(toBadge(d));
  }
  return out;
}

function extractDecorators(host: unknown): CalmDecorator[] | undefined {
  if (!host || typeof host !== 'object') return undefined;
  const d = (host as { decorators?: unknown }).decorators;
  return Array.isArray(d) ? (d as CalmDecorator[]) : undefined;
}

export const decoratorsAdapter: BadgeAdapter = {
  name: 'decorators',
  forNode: (node: CalmNode) => emit(extractDecorators(node), 'node'),
  forEdge: (edge: CalmRelationship) => emit(extractDecorators(edge), 'edge'),
};
