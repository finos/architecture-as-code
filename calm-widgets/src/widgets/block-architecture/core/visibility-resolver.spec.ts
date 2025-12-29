import { describe, it, expect } from 'vitest';
import {
    buildDefaultFilterChain,
    resolveVisibilityWithStrategies,
} from './visibility-resolver';
import { FlowFocusStrategy } from './strategies/reduce/flow-focus-strategy';
import { NodeFocusStrategy } from './strategies/reduce/node-focus-strategy';
import { InterfaceFocusStrategy } from './strategies/reduce/interface-focus-strategy';
import { ControlFocusStrategy } from './strategies/reduce/control-focus-strategy';
import { RelationshipFocusStrategy } from './strategies/reduce/relationship-focus-strategy';
import { NodeTypeFilterStrategy } from './strategies/reduce/node-type-filter-strategy';
import { ChildrenStrategy } from './strategies/expand/children-strategy';
import { EdgeStrategy } from './strategies/expand/edge-strategy';
import { ContainerStrategy } from './strategies/expand/container-strategy';
import {
    CalmCoreCanonicalModel,
    CalmNodeCanonicalModel,
    CalmRelationshipCanonicalModel,
} from '@finos/calm-models/canonical';
import { ParentHierarchyResult } from './relationship-analyzer';
import { NormalizedOptions } from '../types';

describe('buildDefaultFilterChain', () => {
    it('constructs strategies in the documented order', () => {
        const chain = buildDefaultFilterChain(new Map(), new Map(), new Set());
        const strategies = chain.getStrategies();

        expect(strategies[0]).toBeInstanceOf(FlowFocusStrategy);
        expect(strategies[1]).toBeInstanceOf(NodeFocusStrategy);
        expect(strategies[2]).toBeInstanceOf(InterfaceFocusStrategy);
        expect(strategies[3]).toBeInstanceOf(ControlFocusStrategy);
        expect(strategies[4]).toBeInstanceOf(RelationshipFocusStrategy);
        expect(strategies[5]).toBeInstanceOf(NodeTypeFilterStrategy);
        expect(strategies[6]).toBeInstanceOf(ChildrenStrategy);
        expect(strategies[7]).toBeInstanceOf(EdgeStrategy);
        expect(strategies[8]).toBeInstanceOf(ContainerStrategy);
    });
});

describe('resolveVisibilityWithStrategies functional', () => {
    const nodes: CalmNodeCanonicalModel[] = [
        { 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: '' },
        { 'unique-id': 'db', 'node-type': 'database', name: 'Database', description: '' },
        { 'unique-id': 'actor', 'node-type': 'actor', name: 'Actor', description: '' },
    ];

    const relConnect: CalmRelationshipCanonicalModel = {
        'unique-id': 'r1',
        'relationship-type': {
            connects: {
                source: { node: 'svc', interfaces: ['api'] },
                destination: { node: 'db', interfaces: ['jdbc'] },
            },
        },
    };

    const relInteract: CalmRelationshipCanonicalModel = {
        'unique-id': 'r2',
        'relationship-type': { interacts: { actor: 'actor', nodes: ['svc'] } },
    };

    const relComposed: CalmRelationshipCanonicalModel = {
        'unique-id': 'r3',
        'relationship-type': { 'composed-of': { container: 'svc', nodes: ['db'] } },
    };

    const baseCtx: CalmCoreCanonicalModel = {
        nodes,
        relationships: [relConnect, relInteract, relComposed],
    };

    const parentHierarchy: ParentHierarchyResult = {
        parentOf: new Map([['db', 'svc']]),
        allMentionedContainers: new Set(['svc']),
        childrenOfContainer: new Map([['svc', new Set(['db'])]]),
        warnings: [],
    };

    const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));

    const baseOpts = (
        over: Partial<NormalizedOptions> = {}
    ): NormalizedOptions => ({
        includeContainers: 'all',
        includeChildren: 'all',
        edges: 'connected',
        direction: 'both',
        renderInterfaces: false,
        renderNodeTypeShapes: false,
        edgeLabels: 'description',
        collapseRelationships: false,
        theme: 'light',
        ...over,
    });

    it('seeds all nodes when no focus options', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts(),
            parentHierarchy,
            nodesById
        );
        expect(res.visibleNodes).toEqual(new Set(['svc', 'db', 'actor']));
    });

    it('seeds empty set when focusNodes provided (svc expands to db)', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ focusNodes: ['svc'] }),
            parentHierarchy,
            nodesById
        );
        expect(res.visibleNodes.has('svc')).toBe(true);
        expect(res.visibleNodes.has('db')).toBe(true); // expansion from svc
    });


    it('edges=none filters out all connects/interacts', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ edges: 'none' }),
            parentHierarchy,
            nodesById
        );
        expect(res.filteredRels.find((r) => r['unique-id'] === 'r1')).toBeUndefined();
        expect(res.filteredRels.find((r) => r['unique-id'] === 'r2')).toBeUndefined();
    });

    it('edges=connected includes connects when both nodes visible', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ edges: 'connected' }),
            parentHierarchy,
            nodesById
        );
        expect(res.filteredRels.some((r) => r['unique-id'] === 'r1')).toBe(true);
    });

    it('edges=seeded includes connects only when both nodes visible', () => {
        const res1 = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ edges: 'seeded', focusNodes: ['svc'] }),
            parentHierarchy,
            nodesById
        );
        // svc expands to db, so r1 is included
        expect(res1.filteredRels.some((r) => r['unique-id'] === 'r1')).toBe(true);

        const res2 = resolveVisibilityWithStrategies(
            { ...baseCtx, relationships: [relConnect] },
            baseOpts({ edges: 'seeded', focusNodes: ['svc'], includeChildren: 'none' }),
            { parentOf: new Map(), allMentionedContainers: new Set(), childrenOfContainer: new Map(), warnings: [] },
            new Map(nodes.map((n) => [n['unique-id'], n]))
        );
        // only svc visible (no expansion to db because includeChildren=none, edges=seeded doesn’t expand)
        expect(res2.filteredRels.some((r) => r['unique-id'] === 'r1')).toBe(false);
    });



    it('includes composed-of when container + child visible', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts(),
            parentHierarchy,
            nodesById
        );
        expect(res.filteredRels.some((r) => r['unique-id'] === 'r3')).toBe(true);
    });

    it('includeContainers=none excludes container IDs', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ includeContainers: 'none' }),
            parentHierarchy,
            nodesById
        );
        expect(res.containerIds.has('svc')).toBe(false);
    });

    it('includeContainers=parents includes only direct parents', () => {
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts({ includeContainers: 'parents' }),
            parentHierarchy,
            nodesById
        );
        expect(res.containerIds.has('svc')).toBe(true);
        expect(res.containerIds.size).toBe(1);
    });

    it('propagates warnings from parentHierarchy', () => {
        const parentWithWarnings: ParentHierarchyResult = {
            ...parentHierarchy,
            warnings: ['cycle detected'],
        };
        const res = resolveVisibilityWithStrategies(
            baseCtx,
            baseOpts(),
            parentWithWarnings,
            nodesById
        );
        expect(res.warnings).toContain('cycle detected');
    });
});
