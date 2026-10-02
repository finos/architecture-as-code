import { describe, it, expect } from 'vitest';
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
});
