import type { ShapeHint } from './types';

const SHAPE_TO_NODE_TYPE: Record<ShapeHint, string> = {
    'cylinder': 'database',
    'person': 'actor',
    'cloud': 'ecosystem',
    'ellipse': 'system',
    'hexagon': 'service',
    'diamond': 'service',
    'rectangle': 'system',
    'rounded-rectangle': 'service',
    'document': 'data-asset',
    'parallelogram': 'data-asset',
    'unknown': 'system',
};

const LABEL_PATTERNS: Array<[RegExp, string]> = [
    [/\b(user|actor|person|customer|client|operator)\b/i, 'actor'],
    [/\b(db|database|datastore|data.?store|storage|redis|postgres|mysql|mongo|dynamo|cassandra)\b/i, 'database'],
    [/\b(browser|web.?app|frontend|ui|spa|portal)\b/i, 'webclient'],
    [/\b(network|vpc|subnet|firewall|dmz|zone|vnet)\b/i, 'network'],
    [/\b(ldap|active.?directory)\b/i, 'ldap'],
    [/\b(ecosystem|external|third.?party|cloud|platform)\b/i, 'ecosystem'],
];

export function mapShapeToNodeType(shapeHint: ShapeHint, label: string): string {
    // Label-based overrides take priority for strong signals
    for (const [pattern, nodeType] of LABEL_PATTERNS) {
        if (pattern.test(label)) return nodeType;
    }

    return SHAPE_TO_NODE_TYPE[shapeHint] ?? 'system';
}
