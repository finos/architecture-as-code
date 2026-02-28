import { describe, it, expect } from 'vitest';
import { Node, Edge } from 'reactflow';
import {
    extractDecisionPoints,
    isDecisionFilterActive,
    getDecisionGovernedNodeIds,
    getDecisionGovernedRelationshipIds,
    getVisibleNodeIds,
    getVisibleEdgeIds,
    DecisionSelections,
} from './decisionUtils';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        position: { x: 0, y: 0 },
        type: 'custom',
        data: { label: id },
        ...overrides,
    };
}

function makeDecisionNode(
    id: string,
    decisionType: 'oneOf' | 'anyOf',
    choices: { description: string; nodes: string[]; relationships: string[] }[],
    prompt = 'Decision'
): Node {
    return {
        id,
        position: { x: 0, y: 0 },
        type: 'decisionGroup',
        data: { label: decisionType, decisionType, prompt, choices },
    };
}

function makeEdge(id: string, source: string, target: string, uniqueId?: string): Edge {
    return {
        id,
        source,
        target,
        data: uniqueId ? { 'unique-id': uniqueId } : {},
    };
}

describe('extractDecisionPoints', () => {
    it('extracts decision points from decisionGroup nodes with choices', () => {
        const nodes = [
            makeNode('n1'),
            makeDecisionNode('d1', 'oneOf', [
                { description: 'Option A', nodes: ['a'], relationships: ['rel-a'] },
                { description: 'Option B', nodes: ['b'], relationships: ['rel-b'] },
            ], 'Pick one'),
        ];
        const points = extractDecisionPoints(nodes);
        expect(points).toHaveLength(1);
        expect(points[0].groupId).toBe('d1');
        expect(points[0].decisionType).toBe('oneOf');
        expect(points[0].prompt).toBe('Pick one');
        expect(points[0].choices).toHaveLength(2);
    });

    it('skips decisionGroup nodes without choices', () => {
        const nodes = [
            { id: 'd1', position: { x: 0, y: 0 }, type: 'decisionGroup', data: { label: 'oneOf', decisionType: 'oneOf' } } as Node,
        ];
        expect(extractDecisionPoints(nodes)).toHaveLength(0);
    });

    it('skips non-decisionGroup nodes', () => {
        const nodes = [makeNode('n1')];
        expect(extractDecisionPoints(nodes)).toHaveLength(0);
    });

    it('returns empty array for no nodes', () => {
        expect(extractDecisionPoints([])).toEqual([]);
    });
});

describe('isDecisionFilterActive', () => {
    it('returns false for empty map', () => {
        expect(isDecisionFilterActive(new Map())).toBe(false);
    });

    it('returns false when all selections are empty arrays', () => {
        const sel: DecisionSelections = new Map([['d1', []]]);
        expect(isDecisionFilterActive(sel)).toBe(false);
    });

    it('returns true when any selection has indices', () => {
        const sel: DecisionSelections = new Map([['d1', [0]]]);
        expect(isDecisionFilterActive(sel)).toBe(true);
    });
});

describe('getDecisionGovernedNodeIds', () => {
    it('collects all node IDs across all choices and decisions', () => {
        const points = [
            {
                groupId: 'd1', decisionType: 'oneOf' as const, prompt: '',
                choices: [
                    { description: 'A', nodes: ['a', 'b'], relationships: [] },
                    { description: 'B', nodes: ['c'], relationships: [] },
                ],
            },
            {
                groupId: 'd2', decisionType: 'oneOf' as const, prompt: '',
                choices: [
                    { description: 'X', nodes: ['x'], relationships: [] },
                ],
            },
        ];
        const ids = getDecisionGovernedNodeIds(points);
        expect(ids).toEqual(new Set(['a', 'b', 'c', 'x']));
    });
});

describe('getDecisionGovernedRelationshipIds', () => {
    it('collects all relationship IDs across all choices', () => {
        const points = [
            {
                groupId: 'd1', decisionType: 'oneOf' as const, prompt: '',
                choices: [
                    { description: 'A', nodes: [], relationships: ['r1', 'r2'] },
                    { description: 'B', nodes: [], relationships: ['r3'] },
                ],
            },
        ];
        const ids = getDecisionGovernedRelationshipIds(points);
        expect(ids).toEqual(new Set(['r1', 'r2', 'r3']));
    });
});

describe('getVisibleNodeIds', () => {
    const decisionPoints = [
        {
            groupId: 'd1', decisionType: 'oneOf' as const, prompt: 'Client choice',
            choices: [
                { description: 'Use SPA', nodes: ['spa'], relationships: ['spa-to-svc'] },
                { description: 'Use Consumer', nodes: ['consumer'], relationships: ['consumer-to-svc'] },
            ],
        },
        {
            groupId: 'd2', decisionType: 'oneOf' as const, prompt: 'DB choice',
            choices: [
                { description: 'Postgres', nodes: ['postgres'], relationships: ['svc-to-pg'] },
                { description: 'Mongo', nodes: ['mongo'], relationships: ['svc-to-mongo'] },
            ],
        },
    ];

    const allNodes = [
        makeDecisionNode('d1', 'oneOf', decisionPoints[0].choices),
        makeDecisionNode('d2', 'oneOf', decisionPoints[1].choices),
        makeNode('spa'),
        makeNode('consumer'),
        makeNode('producer'), // always-present
        makeNode('postgres'),
        makeNode('mongo'),
    ];

    it('returns null when no filter is active', () => {
        expect(getVisibleNodeIds(allNodes, decisionPoints, new Map())).toBeNull();
    });

    it('shows selected nodes + always-present nodes', () => {
        const sel: DecisionSelections = new Map([['d1', [0]], ['d2', [0]]]);
        const visible = getVisibleNodeIds(allNodes, decisionPoints, sel)!;
        expect(visible.has('spa')).toBe(true);
        expect(visible.has('postgres')).toBe(true);
        expect(visible.has('producer')).toBe(true); // always-present
        expect(visible.has('consumer')).toBe(false);
        expect(visible.has('mongo')).toBe(false);
    });

    it('shows all options for decisions without selections', () => {
        const sel: DecisionSelections = new Map([['d1', [1]]]); // only d1 selected
        const visible = getVisibleNodeIds(allNodes, decisionPoints, sel)!;
        expect(visible.has('consumer')).toBe(true); // selected in d1
        expect(visible.has('spa')).toBe(false); // not selected in d1
        expect(visible.has('postgres')).toBe(true); // d2 has no selection, show all
        expect(visible.has('mongo')).toBe(true); // d2 has no selection, show all
    });

    it('keeps group and decisionGroup nodes always visible', () => {
        const nodes = [
            ...allNodes,
            makeNode('g1', { type: 'group' }),
        ];
        const sel: DecisionSelections = new Map([['d1', [0]]]);
        const visible = getVisibleNodeIds(nodes, decisionPoints, sel)!;
        expect(visible.has('d1')).toBe(true);
        expect(visible.has('d2')).toBe(true);
        expect(visible.has('g1')).toBe(true);
    });

    it('handles union across multiple decisions', () => {
        const sel: DecisionSelections = new Map([['d1', [1]], ['d2', [1]]]);
        const visible = getVisibleNodeIds(allNodes, decisionPoints, sel)!;
        expect(visible.has('consumer')).toBe(true);
        expect(visible.has('mongo')).toBe(true);
        expect(visible.has('producer')).toBe(true);
        expect(visible.has('spa')).toBe(false);
        expect(visible.has('postgres')).toBe(false);
    });
});

describe('getVisibleEdgeIds', () => {
    const decisionPoints = [
        {
            groupId: 'd1', decisionType: 'oneOf' as const, prompt: '',
            choices: [
                { description: 'A', nodes: ['a'], relationships: ['rel-a'] },
                { description: 'B', nodes: ['b'], relationships: ['rel-b'] },
            ],
        },
    ];

    it('shows edges with selected relationship IDs', () => {
        const edges = [
            makeEdge('e1', 'a', 'svc', 'rel-a'),
            makeEdge('e2', 'b', 'svc', 'rel-b'),
        ];
        const visibleNodes = new Set(['a', 'svc']);
        const sel: DecisionSelections = new Map([['d1', [0]]]);
        const visible = getVisibleEdgeIds(edges, visibleNodes, decisionPoints, sel);
        expect(visible.has('e1')).toBe(true);
        expect(visible.has('e2')).toBe(false);
    });

    it('shows non-governed edges when both endpoints are visible', () => {
        const edges = [
            makeEdge('e1', 'svc', 'db'), // no unique-id in any decision
        ];
        const visibleNodes = new Set(['svc', 'db']);
        const sel: DecisionSelections = new Map([['d1', [0]]]);
        const visible = getVisibleEdgeIds(edges, visibleNodes, decisionPoints, sel);
        expect(visible.has('e1')).toBe(true);
    });

    it('hides non-governed edges when an endpoint is not visible', () => {
        const edges = [
            makeEdge('e1', 'svc', 'hidden'),
        ];
        const visibleNodes = new Set(['svc']);
        const sel: DecisionSelections = new Map([['d1', [0]]]);
        const visible = getVisibleEdgeIds(edges, visibleNodes, decisionPoints, sel);
        expect(visible.has('e1')).toBe(false);
    });

    it('shows all decision edges when decision has no selection', () => {
        const edges = [
            makeEdge('e1', 'a', 'svc', 'rel-a'),
            makeEdge('e2', 'b', 'svc', 'rel-b'),
        ];
        const visibleNodes = new Set(['a', 'b', 'svc']);
        const sel: DecisionSelections = new Map(); // no selection
        const visible = getVisibleEdgeIds(edges, visibleNodes, decisionPoints, sel);
        expect(visible.has('e1')).toBe(true);
        expect(visible.has('e2')).toBe(true);
    });
});
