import { describe, it, expect } from 'vitest';
import type { StandardNodeDef } from '../../extension/services/workspace-asset-service';
import { instantiateFromPattern } from './pattern-instantiation';

const node = (id: string) => ({
    type: 'object',
    properties: { 'unique-id': { const: id }, 'node-type': { const: 'service' }, name: { const: id } },
});

const relationship = (id: string) => ({
    type: 'object',
    properties: { 'unique-id': { const: id } },
});

const connects = (id: string, source: string, destination: string) => ({
    type: 'object',
    properties: {
        'unique-id': { const: id },
        'relationship-type': {
            properties: {
                connects: {
                    properties: {
                        source: { properties: { node: { const: source } } },
                        destination: { properties: { node: { const: destination } } },
                    },
                },
            },
        },
    },
});

const deployedIn = (id: string, container: string, nodes: string[]) => ({
    type: 'object',
    properties: {
        'unique-id': { const: id },
        'relationship-type': {
            properties: {
                'deployed-in': {
                    properties: {
                        container: { const: container },
                        nodes: { prefixItems: nodes.map((n) => ({ const: n })) },
                    },
                },
            },
        },
    },
});

const ids = (elements: any[]) => elements.map((element) => element['unique-id']);

describe('instantiateFromPattern', () => {
    it('instantiates a node declared in a prefixItems entry', () => {
        const arch = instantiateFromPattern({ properties: { nodes: { prefixItems: [node('gateway')] } } });

        expect(arch.nodes).toEqual([{ 'unique-id': 'gateway', 'node-type': 'service', name: 'gateway' }]);
    });

    it('takes the first alternative of a prefixItems entry', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [{ oneOf: [node('postgres'), node('mysql')] }] } },
        });

        expect(ids(arch.nodes)).toEqual(['postgres']);
    });

    it('skips an alternative it cannot build and takes the next one', () => {
        // A bare $ref pins nothing, so taking it literally left the position empty while the
        // relationships that name it were still built.
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [{ oneOf: [{ $ref: 'core.json#/defs/node' }, node('cache')] }] } },
        });

        expect(ids(arch.nodes)).toEqual(['cache']);
    });

    it('returns empty arrays for a pattern that declares nothing', () => {
        expect(instantiateFromPattern({})).toEqual({ nodes: [], relationships: [] });
    });

    describe('choosing a relationship that fits the nodes it built', () => {
        it('takes the alternative whose endpoints were built, not the first one', () => {
            // The node catalogue offers cache or queue and the picker builds cache. Taking the
            // first relationship names queue, which is not there, and the canvas cannot draw it.
            const arch = instantiateFromPattern({
                properties: {
                    nodes: { prefixItems: [node('gateway'), { oneOf: [node('cache'), node('queue')] }] },
                    relationships: {
                        prefixItems: [{
                            oneOf: [
                                connects('gateway-connects-queue', 'gateway', 'queue'),
                                connects('gateway-connects-cache', 'gateway', 'cache'),
                            ],
                        }],
                    },
                },
            });

            expect(ids(arch.nodes)).toEqual(['gateway', 'cache']);
            expect(ids(arch.relationships)).toEqual(['gateway-connects-cache']);
        });

        it('reads the endpoints of a deployed-in relationship too', () => {
            const arch = instantiateFromPattern({
                properties: {
                    nodes: { prefixItems: [node('k8s'), { oneOf: [node('cache'), node('queue')] }] },
                    relationships: {
                        prefixItems: [{
                            oneOf: [deployedIn('in-k8s', 'k8s', ['queue']), deployedIn('in-k8s', 'k8s', ['cache'])],
                        }],
                    },
                },
            });

            expect(arch.relationships[0]['relationship-type']['deployed-in'].nodes).toEqual(['cache']);
        });

        it('falls back to the first alternative when none of them fit', () => {
            // A pattern that offers no coherent combination. The position still holds a
            // relationship, so the author sees what the pattern asked for rather than nothing.
            const arch = instantiateFromPattern({
                properties: {
                    nodes: { prefixItems: [node('gateway')] },
                    relationships: {
                        prefixItems: [{
                            oneOf: [
                                connects('gateway-connects-queue', 'gateway', 'queue'),
                                connects('gateway-connects-cache', 'gateway', 'cache'),
                            ],
                        }],
                    },
                },
            });

            expect(ids(arch.relationships)).toEqual(['gateway-connects-queue']);
        });

        it('leaves a relationship that names no node alone', () => {
            const arch = instantiateFromPattern({
                properties: { relationships: { prefixItems: [relationship('standalone')] } },
            });

            expect(ids(arch.relationships)).toEqual(['standalone']);
        });
    });

    describe('items catalogues', () => {
        // A catalogue is what an architecture MAY add, none of it required — see
        // PATTERN-DECISIONS.md. `calm generate` builds no member that a decision does not name,
        // and the picker holds the same line rather than choosing one on the author's behalf.
        it('builds nothing from a node catalogue', () => {
            const arch = instantiateFromPattern({
                properties: { nodes: { prefixItems: [node('gateway')], items: { oneOf: [node('cache'), node('queue')] } } },
            });

            expect(ids(arch.nodes)).toEqual(['gateway']);
        });

        it('builds nothing from a relationship catalogue', () => {
            const arch = instantiateFromPattern({
                properties: { relationships: { items: { oneOf: [relationship('gateway-connects-cache')] } } },
            });

            expect(arch.relationships).toEqual([]);
        });

        it('builds nothing from an items schema that declares a node directly', () => {
            const arch = instantiateFromPattern({
                properties: { nodes: { prefixItems: [node('gateway')], items: node('cache') } },
            });

            expect(ids(arch.nodes)).toEqual(['gateway']);
        });
    });

    describe('standard node resolution via definition-id', () => {
        const hubStdNode: StandardNodeDef = {
            id: 'service',
            name: 'Service',
            behaviour: 'create-node',
            controls: {
                'Resiliency Tier': {
                    description: 'Recovery time commitments',
                    requirements: [{ 'requirement-url': 'platform:controls:resiliency-tier' }],
                },
            },
            nodeType: 'service',
            namespace: 'OSS-NY-Demo',
            sha: 'ecab061',
        };

        const localStdNode: StandardNodeDef = {
            id: 'database',
            name: 'Database',
            behaviour: 'create-node',
            controls: {
                'Data Classification': {
                    description: 'Highest data classification',
                    requirements: [{ 'requirement-url': 'controls/security/data-classification.json' }],
                },
            },
            nodeType: 'database',
        };

        const nodeWithDefId = (id: string, defId: string) => ({
            type: 'object',
            properties: {
                'unique-id': { const: id },
                'node-type': { const: 'service' },
                name: { const: id },
                'definition-id': { const: defId },
            },
        });

        it('copies controls from a Hub standard node and upgrades definition-id to a versioned CURIE', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:standards:service@ecab061');
            expect(arch.nodes[0].controls).toHaveProperty('Resiliency Tier');
            expect(arch.nodes[0].controls['Resiliency Tier'].requirements[0]['requirement-url']).toBe('platform:controls:resiliency-tier');
        });

        it('does not seed config — enrichment handles that', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [hubStdNode],
            );

            const req = arch.nodes[0].controls['Resiliency Tier'].requirements[0];
            expect(req.config).toBeUndefined();
        });

        it('removes definition-id and sets metadata for a local standard node', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('db', 'database')] } } },
                [localStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBeUndefined();
            expect(arch.nodes[0].metadata).toEqual({ 'source-standard-node': 'database' });
            expect(arch.nodes[0].controls).toHaveProperty('Data Classification');
        });

        it('matches a CURIE definition-id using namespace and id', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'OSS-NY-Demo:standards:service')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:standards:service@ecab061');
            expect(arch.nodes[0].controls).toHaveProperty('Resiliency Tier');
        });

        it('does not match a CURIE from a different namespace', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'TeamB:standards:service')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('TeamB:standards:service');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('does not match a CURIE with a non-standards type', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'OSS-NY-Demo:controls:service')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:controls:service');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('preserves a pinned version and skips resolution', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'OSS-NY-Demo:standards:service@v1')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:standards:service@v1');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('leaves a node unchanged when no standard node matches', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'unknown-type')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('unknown-type');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('works without standardNodes (backward compatible)', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
            );

            expect(arch.nodes[0]['definition-id']).toBe('service');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('skips standard nodes with apply-controls-on-drop behaviour', () => {
            const applyNode: StandardNodeDef = { ...hubStdNode, behaviour: 'apply-controls-on-drop' };
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [applyNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('service');
            expect(arch.nodes[0].controls).toBeUndefined();
        });

        it('skips Hub standard nodes with numeric-only ids', () => {
            const numericNode: StandardNodeDef = { ...hubStdNode, id: '42' };
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', '42')] } } },
                [numericNode],
            );

            expect(arch.nodes[0]['definition-id']).toBeUndefined();
            expect(arch.nodes[0].metadata).toEqual({ 'source-standard-node': '42' });
        });

        it('merges pattern-level controls on top of standard node controls', () => {
            const nodeSchema = {
                type: 'object',
                properties: {
                    'unique-id': { const: 'gw' },
                    'node-type': { const: 'service' },
                    name: { const: 'Gateway' },
                    'definition-id': { const: 'service' },
                    controls: {
                        const: {
                            'Custom Control': {
                                description: 'Pattern-specific',
                                requirements: [{ 'requirement-url': 'custom:controls:thing' }],
                            },
                        },
                    },
                },
            };
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeSchema] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0].controls).toHaveProperty('Resiliency Tier');
            expect(arch.nodes[0].controls).toHaveProperty('Custom Control');
            expect(arch.nodes[0].controls['Custom Control'].description).toBe('Pattern-specific');
        });

        it('pattern const values for name take precedence over standard node name', () => {
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [hubStdNode],
            );

            expect(arch.nodes[0].name).toBe('gw');
            expect(arch.nodes[0]['node-type']).toBe('service');
        });

        it('prefers a Hub-sourced standard node over a local one with the same bare id', () => {
            const localDup: StandardNodeDef = { ...localStdNode, id: 'service', controls: { 'Local Only': { description: 'local' } } };
            const arch = instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [localDup, hubStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:standards:service@ecab061');
            expect(arch.nodes[0].controls).toHaveProperty('Resiliency Tier');
            expect(arch.nodes[0].controls).not.toHaveProperty('Local Only');
        });

        it('does not mutate the original standard node controls', () => {
            const controlsBefore = JSON.stringify(hubStdNode.controls);
            instantiateFromPattern(
                { properties: { nodes: { prefixItems: [nodeWithDefId('gw', 'service')] } } },
                [hubStdNode],
            );

            expect(JSON.stringify(hubStdNode.controls)).toBe(controlsBefore);
        });

        it('resolves standard nodes for multiple nodes independently', () => {
            const arch = instantiateFromPattern(
                {
                    properties: {
                        nodes: {
                            prefixItems: [
                                nodeWithDefId('gw', 'service'),
                                nodeWithDefId('db', 'database'),
                            ],
                        },
                    },
                },
                [hubStdNode, localStdNode],
            );

            expect(arch.nodes[0]['definition-id']).toBe('OSS-NY-Demo:standards:service@ecab061');
            expect(arch.nodes[0].controls).toHaveProperty('Resiliency Tier');
            expect(arch.nodes[1]['definition-id']).toBeUndefined();
            expect(arch.nodes[1].controls).toHaveProperty('Data Classification');
        });
    });
});
