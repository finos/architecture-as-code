import type { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '../types/index.js';
import { describe, it, expect } from 'vitest';
import { diffArchitectures, nodeStructureMatches, relationshipStructureMatches } from './diff.js';
import testArchitectures from './fixtures/diff-test-architectures.json' with { type: 'json' };

describe('diff', () => {
    describe('nodeStructureMatches', () => {
        it('returns true for identical nodes with different IDs', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(true);
        });

        it('returns true regardless of key order, including nested metadata', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
                metadata: { version: '1.0', details: { priority: 'high', owner: 'finance' } },
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                metadata: { details: { owner: 'finance', priority: 'high' }, version: '1.0' },
                name: 'Payment Service',
                description: 'Handles payments',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(true);
        });

        it('returns false when properties differ', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                name: 'Different Name',
                description: 'Handles payments',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(false);
        });

        it('treats array order as significant', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
                metadata: { tags: ['api', 'web'] },
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                name: 'Payment Service',
                description: 'Handles payments',
                metadata: { tags: ['web', 'api'] },
            };
            expect(nodeStructureMatches(node1, node2)).toBe(false);
        });
    });

    describe('relationshipStructureMatches', () => {
        const connects = (src: string, dst: string) => ({
            connects: { source: { node: src }, destination: { node: dst } },
        });

        it('returns true for identical relationships with different IDs', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                description: 'connects to payment',
                'relationship-type': connects('api', 'payment'),
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                description: 'connects to payment',
                'relationship-type': connects('api', 'payment'),
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(true);
        });

        it('returns false when destination differs', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                description: 'connects to payment',
                'relationship-type': connects('api', 'payment'),
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                description: 'connects to payment',
                'relationship-type': connects('api', 'audit'),
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(false);
        });
    });

    describe('diffArchitectures - node changes', () => {
        it('detects added nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.nodesAdded).toHaveLength(1);
            expect(result.nodesAdded[0]['unique-id']).toBe('audit-service');
        });

        it('detects removed nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.removalArchitecture);
            expect(result.nodesRemoved).toHaveLength(1);
            expect(result.nodesRemoved[0]['unique-id']).toBe('user-db');
        });

        it('detects modified nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.modificationArchitecture);
            expect(result.nodesModified).toHaveLength(1);
            expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
            expect(result.nodesModified[0].updated.name).toBe('API Gateway v2');
        });

        it('detects renamed nodes and excludes them from added/removed', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.renameArchitecture);
            expect(result.nodesRenamed).toHaveLength(1);
            expect(result.nodesRenamed[0].oldId).toBe('payment-service');
            expect(result.nodesRenamed[0].newId).toBe('payment-processor');
            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
        });

        it('treats renamed nodes with modified properties as removed and added', () => {
            const modifiedRenameArchitecture = {
                ...testArchitectures.baseArchitecture,
                nodes: testArchitectures.renameArchitecture.nodes.map((node) =>
                    node['unique-id'] === 'payment-processor'
                        ? { ...node, name: 'Payment Processor v2' }
                        : node,
                ),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, modifiedRenameArchitecture);
            expect(result.nodesRenamed).toHaveLength(0);
            expect(result.nodesAdded.some((n) => n['unique-id'] === 'payment-processor')).toBe(true);
            expect(result.nodesRemoved.some((n) => n['unique-id'] === 'payment-service')).toBe(true);
        });

        it('detects unchanged nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.nodesSame.length).toBeGreaterThan(0);
            expect(result.nodesSame.some((n) => n['unique-id'] === 'api-gateway')).toBe(true);
        });
    });

    describe('diffArchitectures - relationship changes', () => {
        it('detects added relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.edgesAdded).toHaveLength(1);
            expect(result.edgesAdded[0]['unique-id']).toBe('payment-to-audit');
        });

        it('detects removed relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.removalArchitecture);
            expect(result.edgesRemoved).toHaveLength(1);
            expect(result.edgesRemoved[0]['unique-id']).toBe('payment-to-db');
        });

        it('detects modified relationships', () => {
            const result = diffArchitectures(
                testArchitectures.baseArchitecture,
                testArchitectures.relationshipModificationArchitecture,
            );
            expect(result.edgesModified).toHaveLength(1);
            expect(result.edgesModified[0].original['unique-id']).toBe('gateway-to-payment');
            expect(result.edgesModified[0].updated.description).toBe('Gateway routes to payment service (modified)');
        });

        it('detects renamed relationships and excludes them from added/removed', () => {
            const result = diffArchitectures(
                testArchitectures.baseArchitecture,
                testArchitectures.relationshipRenameArchitecture,
            );
            expect(result.edgesRenamed).toHaveLength(1);
            expect(result.edgesRenamed[0].oldId).toBe('gateway-to-payment');
            expect(result.edgesRenamed[0].newId).toBe('gateway-to-payment-renamed');
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
        });

        it('treats renamed relationships with modified properties as removed and added', () => {
            const modified = {
                ...testArchitectures.baseArchitecture,
                relationships: testArchitectures.relationshipRenameArchitecture.relationships.map((rel) =>
                    rel['unique-id'] === 'gateway-to-payment-renamed'
                        ? { ...rel, description: 'Gateway routes to payment service (updated)' }
                        : rel,
                ),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, modified);
            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.edgesAdded.some((e) => e['unique-id'] === 'gateway-to-payment-renamed')).toBe(true);
            expect(result.edgesRemoved.some((e) => e['unique-id'] === 'gateway-to-payment')).toBe(true);
        });

        it('skips relationships missing unique-id but surfaces them via invalidItems', () => {
            const arch = {
                ...testArchitectures.baseArchitecture,
                relationships: [
                    ...testArchitectures.baseArchitecture.relationships,
                    { description: 'invalid without unique-id' },
                ],
            } as CalmArchitectureSchema;
            const result = diffArchitectures(testArchitectures.baseArchitecture, arch);
            expect(
                result.edgesAdded.length +
                    result.edgesRemoved.length +
                    result.edgesModified.length +
                    result.edgesRenamed.length,
            ).toBe(0);
            expect(result.invalidItems?.relationships).toHaveLength(1);
            expect(result.invalidItems?.nodes).toHaveLength(0);
        });

        it('marks ambiguous matches as added rather than guessing renames', () => {
            const arch = {
                ...testArchitectures.baseArchitecture,
                relationships: [
                    ...testArchitectures.baseArchitecture.relationships,
                    {
                        'unique-id': 'new-connection-1',
                        description: 'New connection',
                        'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
                    },
                    {
                        'unique-id': 'new-connection-2',
                        description: 'New connection',
                        'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
                    },
                ],
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, arch);
            expect(result.edgesAdded).toHaveLength(2);
            expect(result.edgesRenamed).toHaveLength(0);
        });

        it('handles duplicate unique-ids by last-wins', () => {
            const arch = {
                ...testArchitectures.baseArchitecture,
                relationships: [
                    ...testArchitectures.baseArchitecture.relationships,
                    {
                        'unique-id': 'gateway-to-payment',
                        description: 'Duplicate gateway route',
                        'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
                    },
                ],
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, arch);
            expect(result.edgesModified).toHaveLength(1);
            expect(result.edgesModified[0].updated.description).toBe('Duplicate gateway route');
        });

        it('detects metadata-only node changes', () => {
            const result = diffArchitectures(
                testArchitectures.baseArchitecture,
                testArchitectures.metadataChangeArchitecture,
            );
            expect(result.nodesModified).toHaveLength(1);
            expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
            expect(result.nodesModified[0].updated.metadata).toEqual({ version: '2.0', tags: ['web', 'api'] });
        });

        it('skips nodes missing unique-id but surfaces them via invalidItems', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.invalidShapeArchitecture as CalmArchitectureSchema);
            expect(
                result.nodesAdded.length +
                    result.nodesRemoved.length +
                    result.nodesModified.length +
                    result.nodesRenamed.length,
            ).toBe(0);
            expect(result.invalidItems?.nodes.length ?? 0).toBeGreaterThan(0);
        });

        it('reports invalid items found in either side of the diff', () => {
            const archA = {
                ...testArchitectures.baseArchitecture,
                nodes: [...testArchitectures.baseArchitecture.nodes, { 'node-type': 'service', name: 'no id A' }],
            } as CalmArchitectureSchema;
            const archB = {
                ...testArchitectures.baseArchitecture,
                relationships: [
                    ...testArchitectures.baseArchitecture.relationships,
                    { description: 'no id B' },
                ],
            } as CalmArchitectureSchema;
            const result = diffArchitectures(archA, archB);
            expect(result.invalidItems?.nodes).toHaveLength(1);
            expect(result.invalidItems?.relationships).toHaveLength(1);
        });
    });

    describe('diffArchitectures - ADR changes', () => {
        it('records the unchanged and added ADR when an ADR is added', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.adrAdditionArchitecture);
            expect(result.adrDiffItems).toEqual([
                {
                    content: testArchitectures.baseArchitecture.adrs[0],
                    changeType: 'unchanged'
                },
                {
                    content: testArchitectures.adrAdditionArchitecture.adrs[1],
                    changeType: 'added'
                }
            ]);
        });

        it('records the removed ADR when an ADR is removed', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.adrRemovalArchitecture);
            expect(result.adrDiffItems).toEqual([
                {
                    content: testArchitectures.baseArchitecture.adrs[0],
                    changeType: 'removed'
                }
            ]);
        });

        it('records the removed then added ADR when an ADR is modified', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.adrModificationArchitecture);
            expect(result.adrDiffItems).toEqual([
                {
                    content: testArchitectures.baseArchitecture.adrs[0],
                    changeType: 'removed'
                },
                {
                    content: testArchitectures.adrModificationArchitecture.adrs[0],
                    changeType: 'added'
                }
            ]);
        });
    });

    describe('diffArchitectures - comprehensive scenarios', () => {
        const empty = (): CalmArchitectureSchema => ({
            $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
            nodes: [],
            relationships: [],
        } as CalmArchitectureSchema);

        it('handles empty architectures', () => {
            const result = diffArchitectures(empty(), empty());
            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
        });

        it('handles missing arrays gracefully', () => {
            const arch = { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json' } as CalmArchitectureSchema;
            const result = diffArchitectures(arch, arch);
            expect(result.nodesAdded).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
        });

        it('reports no changes for identical architectures', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.baseArchitecture);
            expect(result.nodesModified).toHaveLength(0);
            expect(result.nodesRenamed).toHaveLength(0);
            expect(result.edgesModified).toHaveLength(0);
            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.nodesSame).toHaveLength(testArchitectures.baseArchitecture.nodes?.length ?? 0);
            expect(result.edgesSame).toHaveLength(testArchitectures.baseArchitecture.relationships?.length ?? 0);
        });

        it('ignores top-level array order', () => {
            const reordered = {
                ...testArchitectures.baseArchitecture,
                nodes: [...testArchitectures.baseArchitecture.nodes].reverse(),
                relationships: [...testArchitectures.baseArchitecture.relationships].reverse(),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, reordered);
            expect(result.nodesModified).toHaveLength(0);
            expect(result.edgesModified).toHaveLength(0);
        });
    });
});
