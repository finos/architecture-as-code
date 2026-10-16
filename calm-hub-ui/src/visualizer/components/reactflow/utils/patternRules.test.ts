import { describe, it, expect } from 'vitest';
import { extractPatternRules, hasPatternRules, resolveStandardRef } from './patternRules';

const GOVERNED_NODE = 'https://hub.calm.finos.org/calm/namespaces/finos.agentic-sdlc/standards/governed-node/versions/1.0.0';

// The parts of calm-hub/mongo/patterns/finos.agentic-sdlc/governed-service.pattern.json that the rules read.
const governedServicePattern = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    title: 'Governed service pattern',
    description: 'How this estate enforces the SDLC Common Controls on every architecture.',
    type: 'object',
    properties: {
        nodes: {
            type: 'array',
            items: {
                allOf: [
                    { $ref: GOVERNED_NODE },
                    {
                        type: 'object',
                        properties: {
                            controls: {
                                properties: { 'sdlc-prev-017-service-dependency': { $ref: '#/$defs/service-dependency-control' } },
                            },
                        },
                    },
                ],
            },
        },
        relationships: {
            type: 'array',
            items: { $ref: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship' },
        },
        controls: {
            type: 'object',
            properties: {},
            required: [
                'sdlc-prev-001-code-review',
                'sdlc-prev-004-requirements-repository',
                'sdlc-prev-012-deployment-gating',
                'sdlc-prev-014-test-evidence-retention',
            ],
        },
    },
};

describe('extractPatternRules', () => {
    it('reads the description, node Standards and required controls of a rules-only pattern', () => {
        expect(extractPatternRules(governedServicePattern)).toEqual({
            description: 'How this estate enforces the SDLC Common Controls on every architecture.',
            nodeStandards: [GOVERNED_NODE],
            relationshipStandards: [],
            requiredControls: [
                'sdlc-prev-001-code-review',
                'sdlc-prev-004-requirements-repository',
                'sdlc-prev-012-deployment-gating',
                'sdlc-prev-014-test-evidence-retention',
            ],
        });
    });

    it('ignores CALM meta-schema and local $refs', () => {
        const rules = extractPatternRules({
            properties: {
                nodes: { items: { allOf: [{ $ref: 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node' }, { $ref: '#/$defs/x' }] } },
                relationships: { items: { $ref: 'https://calm.finos.org/release/1.2/meta/core.json' } },
            },
        });

        expect(rules.nodeStandards).toEqual([]);
        expect(rules.relationshipStandards).toEqual([]);
    });

    it('lists a Standard whose path only looks like a CALM meta-schema', () => {
        const ref = 'https://example.com/meta/node.json';

        expect(extractPatternRules({ properties: { nodes: { items: { $ref: ref } } } }).nodeStandards).toEqual([ref]);
    });

    it('reads a Standard $ref placed directly on items', () => {
        const rules = extractPatternRules({ properties: { relationships: { items: { $ref: GOVERNED_NODE } } } });

        expect(rules.relationshipStandards).toEqual([GOVERNED_NODE]);
    });

    it('lists each Standard once', () => {
        const rules = extractPatternRules({
            properties: { nodes: { items: { $ref: GOVERNED_NODE, allOf: [{ $ref: GOVERNED_NODE }] } } },
        });

        expect(rules.nodeStandards).toEqual([GOVERNED_NODE]);
    });

    it('reads declarations inside a top-level allOf branch', () => {
        const rules = extractPatternRules({
            allOf: [
                { $ref: 'https://calm.finos.org/release/1.2/meta/calm.json' },
                {
                    properties: {
                        nodes: { items: { $ref: GOVERNED_NODE } },
                        controls: { required: ['code-review'] },
                    },
                },
            ],
        });

        expect(rules.nodeStandards).toEqual([GOVERNED_NODE]);
        expect(rules.requiredControls).toEqual(['code-review']);
    });

    it('merges rules from the root and every allOf branch', () => {
        const otherStandard = 'https://hub.calm.finos.org/calm/namespaces/ns/standards/other/versions/1.0.0';
        const rules = extractPatternRules({
            properties: { controls: { required: ['code-review'] } },
            allOf: [
                { properties: { nodes: { items: { $ref: GOVERNED_NODE } }, controls: { required: ['deployment-gating', 'code-review'] } } },
                { properties: { nodes: { items: { $ref: otherStandard } } } },
            ],
        });

        expect(rules.nodeStandards).toEqual([GOVERNED_NODE, otherStandard]);
        expect(rules.requiredControls).toEqual(['code-review', 'deployment-gating']);
    });

    it('returns no rules for a pattern without items or required controls', () => {
        const rules = extractPatternRules({ description: 'Nothing enforced', properties: { nodes: { prefixItems: [] } } });

        expect(rules).toEqual({ description: 'Nothing enforced', nodeStandards: [], relationshipStandards: [], requiredControls: [] });
        expect(hasPatternRules(rules)).toBe(false);
    });

    it.each([null, undefined, 'not a pattern', 42])('returns no rules for %p', (input) => {
        const rules = extractPatternRules(input as unknown as Record<string, unknown>);

        expect(rules).toEqual({ description: undefined, nodeStandards: [], relationshipStandards: [], requiredControls: [] });
    });

    it('ignores values of the wrong type', () => {
        const rules = extractPatternRules({
            description: 7,
            properties: {
                nodes: { items: { $ref: 3 } },
                controls: { required: ['code-review', 5] },
            },
        });

        expect(rules).toEqual({ description: undefined, nodeStandards: [], relationshipStandards: [], requiredControls: ['code-review'] });
    });
});

describe('hasPatternRules', () => {
    const none = { nodeStandards: [], relationshipStandards: [], requiredControls: [] };

    it('is true when the pattern applies a Standard or requires a control', () => {
        expect(hasPatternRules({ ...none, nodeStandards: [GOVERNED_NODE] })).toBe(true);
        expect(hasPatternRules({ ...none, relationshipStandards: [GOVERNED_NODE] })).toBe(true);
        expect(hasPatternRules({ ...none, requiredControls: ['code-review'] })).toBe(true);
    });

    it('is false for a description alone', () => {
        expect(hasPatternRules({ ...none, description: 'Only words' })).toBe(false);
    });
});

describe('resolveStandardRef', () => {
    it('routes a Standard on this CALM Hub in-app', () => {
        expect(resolveStandardRef(GOVERNED_NODE, 'hub.calm.finos.org')).toEqual({
            label: 'governed-node 1.0.0',
            route: '/finos.agentic-sdlc/standards/governed-node/1.0.0',
        });
    });

    it('routes a bare CALM Hub Standard path in-app', () => {
        expect(resolveStandardRef('/calm/namespaces/workshop/standards/api/versions/2.1.0', 'localhost')).toEqual({
            label: 'api 2.1.0',
            route: '/workshop/standards/api/2.1.0',
        });
    });

    it('links a Standard on another CALM Hub to that hub\'s UI page', () => {
        expect(resolveStandardRef(GOVERNED_NODE, 'localhost')).toEqual({
            label: 'governed-node 1.0.0',
            href: 'https://hub.calm.finos.org/#/finos.agentic-sdlc/standards/governed-node/1.0.0',
        });
    });

    it('keeps the port of another CALM Hub', () => {
        expect(resolveStandardRef('http://other-hub:9090/calm/namespaces/ns/standards/node/versions/1.0.0', 'localhost')).toEqual({
            label: 'node 1.0.0',
            href: 'http://other-hub:9090/#/ns/standards/node/1.0.0',
        });
    });

    it('links any other absolute URL externally', () => {
        const ref = 'https://example.com/standards/node.json';

        expect(resolveStandardRef(ref, 'hub.calm.finos.org')).toEqual({ label: ref, href: ref });
    });

    it('shows a relative reference as text', () => {
        expect(resolveStandardRef('standards/node.json', 'hub.calm.finos.org')).toEqual({ label: 'standards/node.json' });
    });

    it('shows a malformed URL as text', () => {
        expect(resolveStandardRef('https://', 'hub.calm.finos.org')).toEqual({ label: 'https://' });
    });
});
