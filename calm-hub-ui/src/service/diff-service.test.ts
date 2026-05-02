import type { CalmArchitectureSchema, CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { describe, it, expect } from 'vitest';
import { diffArchitectures, nodeStructureMatches, relationshipStructureMatches } from './diff-service.js';
import testArchitectures from '../fixtures/diff-test-architectures.json' with { type: 'json' };

describe('diff-service', () => {
    describe('nodeStructureMatches', () => {
        it('should return true for identical nodes with different IDs', () => {
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

        it('should return true for same node content with keys in a different order', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                name: 'Payment Service',
                description: 'Handles payments',
                'node-type': 'service',
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                description: 'Handles payments',
                name: 'Payment Service',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(true);
        });

        it('should return false for nodes with different properties', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                name: 'Different Name',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(false);
        });

        it('should return true for same node content with nested metadata keys in different order', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                metadata: {
                    version: '1.0',
                    details: {
                        priority: 'high',
                        owner: 'finance',
                    },
                },
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                metadata: {
                    details: {
                        owner: 'finance',
                        priority: 'high',
                    },
                    version: '1.0',
                },
                name: 'Payment Service',
            };
            expect(nodeStructureMatches(node1, node2)).toBe(true);
        });

        it('should return false for same node content when metadata array order differs', () => {
            const node1: CalmNodeSchema = {
                'unique-id': 'payment-service',
                'node-type': 'service',
                name: 'Payment Service',
                metadata: {
                    tags: ['api', 'web'],
                },
            };
            const node2: CalmNodeSchema = {
                'unique-id': 'payment-processor',
                'node-type': 'service',
                name: 'Payment Service',
                metadata: {
                    tags: ['web', 'api'],
                },
            };
            expect(nodeStructureMatches(node1, node2)).toBe(false);
        });

    });

    describe('relationshipStructureMatches', () => {
        it('should return true for identical relationships with different IDs', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                description: 'connects to payment',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                description: 'connects to payment',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(true);
        });

        it('should return true for same relationship content with keys in a different order', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
                description: 'connects to payment',
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                description: 'connects to payment',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(true);
        });

        it('should return true for same relationship content with nested metadata keys in different order', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                description: 'connects to payment',
                metadata: {
                    version: '1.0',
                    details: {
                        owner: 'network',
                        priority: 'high',
                    },
                },
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
                metadata: {
                    details: {
                        priority: 'high',
                        owner: 'network',
                    },
                    version: '1.0',
                },
                description: 'connects to payment',
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(true);
        });

        it('should return false for relationships with different destination nodes', () => {
            const rel1: CalmRelationshipSchema = {
                'unique-id': 'rel-1',
                description: 'connects to payment',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'payment' } } },
            };
            const rel2: CalmRelationshipSchema = {
                'unique-id': 'rel-2',
                description: 'connects to payment',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'audit' } } },
            };
            expect(relationshipStructureMatches(rel1, rel2)).toBe(false);
        });
    });

    describe('diffArchitectures - node changes', () => {
        it('should detect added nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.nodesAdded).toHaveLength(1);
            expect(result.nodesAdded[0]['unique-id']).toBe('audit-service');
        });

        it('should detect removed nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.removalArchitecture);
            expect(result.nodesRemoved).toHaveLength(1);
            expect(result.nodesRemoved[0]['unique-id']).toBe('user-db');
        });

        it('should detect modified nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.modificationArchitecture);
            expect(result.nodesModified).toHaveLength(1);
            expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
            expect(result.nodesModified[0].updated.name).toBe('API Gateway v2');
        });

        it('should detect renamed nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.renameArchitecture);
            expect(result.nodesRenamed).toHaveLength(1);
            expect(result.nodesRenamed[0].oldId).toBe('payment-service');
            expect(result.nodesRenamed[0].newId).toBe('payment-processor');
        });

        it('should not mark renamed nodes as added or removed', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.renameArchitecture);
            expect(result.nodesRenamed).toHaveLength(1);
            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
        });

        it('should treat renamed nodes with different properties as removed and added', () => {
            const modifiedRenameArchitecture = {
                ...testArchitectures.baseArchitecture,
                nodes: testArchitectures.renameArchitecture.nodes.map((node) =>
                    node['unique-id'] === 'payment-processor'
                        ? { ...node, name: 'Payment Processor v2' }
                        : node
                ),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, modifiedRenameArchitecture);

            expect(result.nodesRenamed).toHaveLength(0);
            expect(result.nodesAdded.some((n) => n['unique-id'] === 'payment-processor')).toBe(true);
            expect(result.nodesRemoved.some((n) => n['unique-id'] === 'payment-service')).toBe(true);
        });

        it('should detect same nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.nodesSame.length).toBeGreaterThan(0);
            expect(result.nodesSame.some((n) => n['unique-id'] === 'api-gateway')).toBe(true);
        });
    });

    describe('diffArchitectures - relationship changes', () => {
        it('should detect added relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.edgesAdded).toHaveLength(1);
            expect(result.edgesAdded[0]['unique-id']).toBe('payment-to-audit');
        });

        it('should detect removed relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.removalArchitecture);
            expect(result.edgesRemoved).toHaveLength(1);
            expect(result.edgesRemoved[0]['unique-id']).toBe('payment-to-db');
        });

        it('should detect modified relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.relationshipModificationArchitecture);
            expect(result.edgesModified).toHaveLength(1);
            expect(result.edgesModified[0].original['unique-id']).toBe('gateway-to-payment');
            expect(result.edgesModified[0].updated.description).toBe('Gateway routes to payment service (modified)');
        });

        it('should detect renamed relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.relationshipRenameArchitecture);
            expect(result.edgesRenamed).toHaveLength(1);
            expect(result.edgesRenamed[0].oldId).toBe('gateway-to-payment');
            expect(result.edgesRenamed[0].newId).toBe('gateway-to-payment-renamed');
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
        });

        it('should treat renamed relationships with modified properties as removed and added', () => {
            const modifiedRelationshipRenameArchitecture = {
                ...testArchitectures.baseArchitecture,
                relationships: testArchitectures.relationshipRenameArchitecture.relationships.map((rel) =>
                    rel['unique-id'] === 'gateway-to-payment-renamed'
                        ? { ...rel, description: 'Gateway routes to payment service (updated)' }
                        : rel
                ),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, modifiedRelationshipRenameArchitecture);

            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.edgesAdded.some((e) => e['unique-id'] === 'gateway-to-payment-renamed')).toBe(true);
            expect(result.edgesRemoved.some((e) => e['unique-id'] === 'gateway-to-payment')).toBe(true);
        });

        it('should handle invalid relationship shapes gracefully', () => {
            const invalidRelationshipArchitecture = {
                ...testArchitectures.baseArchitecture,
                relationships: [
                    ...testArchitectures.baseArchitecture.relationships,
                    { description: 'invalid without unique-id' },
                ],
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, invalidRelationshipArchitecture);

            expect(result.edgesAdded.length + result.edgesRemoved.length + result.edgesModified.length + result.edgesRenamed.length).toBe(0);
        });

        it('should handle ambiguous relationship rename scenarios (first match wins)', () => {
            const ambiguousRelationshipArchitecture = {
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
            const result = diffArchitectures(testArchitectures.baseArchitecture, ambiguousRelationshipArchitecture);

            expect(result.edgesAdded).toHaveLength(2);
            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.edgesAdded.some((e) => e['unique-id'] === 'new-connection-1')).toBe(true);
            expect(result.edgesAdded.some((e) => e['unique-id'] === 'new-connection-2')).toBe(true);
        });

        it('should handle duplicate relationship unique-ids gracefully (last one wins)', () => {
            const duplicateRelationshipArchitecture = {
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
            const result = diffArchitectures(testArchitectures.baseArchitecture, duplicateRelationshipArchitecture);

            expect(result.edgesModified).toHaveLength(1);
            expect(result.edgesModified[0].updated.description).toBe('Duplicate gateway route');
        });

        it('should detect unchanged relationships', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);
            expect(result.edgesSame).toHaveLength(3);
            expect(result.edgesSame.some((e) => e['unique-id'] === 'trader-to-gateway')).toBe(true);
        });

        it('should detect metadata changes on nodes', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.metadataChangeArchitecture);
            expect(result.nodesModified).toHaveLength(1);
            expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
            expect(result.nodesModified[0].updated.metadata).toEqual({
                version: "2.0",
                tags: ["web", "api"]
            });
        });

        it('should handle duplicate unique-ids gracefully (last one wins)', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.duplicateIdArchitecture);
            // The duplicate api-gateway should overwrite the original, so it appears as modified
            expect(result.nodesModified).toHaveLength(1);
            expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
            expect(result.nodesModified[0].updated.name).toBe('Duplicate API Gateway');
        });

        it('should handle invalid node shapes gracefully', () => {
            // Nodes without unique-id should be ignored in the Map creation
            expect(() => {
                diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.invalidShapeArchitecture);
            }).not.toThrow();
            
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.invalidShapeArchitecture);
            // The invalid node should not be included in the diff
            expect(result.nodesAdded.length + result.nodesRemoved.length + result.nodesModified.length + result.nodesRenamed.length).toBe(0);
        });

        it('should handle ambiguous rename scenarios (first match wins)', () => {
            // ambiguousRenameArchitecture has two new services with identical descriptions
            // When comparing to base, they should both be detected as added
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.ambiguousRenameArchitecture);
            expect(result.nodesAdded).toHaveLength(2);
            expect(result.nodesAdded.some(n => n['unique-id'] === 'audit-service')).toBe(true);
            expect(result.nodesAdded.some(n => n['unique-id'] === 'logging-service')).toBe(true);
        });
    });

    describe('diffArchitectures - comprehensive scenarios', () => {
        it('should handle empty architectures', () => {
            const empty1 = { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json', nodes: [], relationships: [] };
            const empty2 = { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json', nodes: [], relationships: [] };
            const result = diffArchitectures(empty1, empty2);

            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
        });

        it('should handle missing arrays gracefully', () => {
            const arch1 = { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json' };
            const arch2 = { $schema: 'https://calm.finos.org/release/1.2/meta/calm.json' };
            const result = diffArchitectures(arch1 as CalmArchitectureSchema, arch2 as CalmArchitectureSchema);

            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
        });

        it('should report no changes for identical architectures', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.baseArchitecture);

            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.nodesModified).toHaveLength(0);
            expect(result.nodesRenamed).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
            expect(result.edgesModified).toHaveLength(0);
            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.nodesSame).toHaveLength(testArchitectures.baseArchitecture.nodes?.length ?? 0);
            expect(result.edgesSame).toHaveLength(testArchitectures.baseArchitecture.relationships?.length ?? 0);
        });

        it('should ignore architecture array ordering when content is the same', () => {
            const reorderedArchitecture = {
                ...testArchitectures.baseArchitecture,
                nodes: [...testArchitectures.baseArchitecture.nodes].reverse(),
                relationships: [...testArchitectures.baseArchitecture.relationships].reverse(),
            };
            const result = diffArchitectures(testArchitectures.baseArchitecture, reorderedArchitecture);

            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.nodesModified).toHaveLength(0);
            expect(result.nodesRenamed).toHaveLength(0);
            expect(result.edgesAdded).toHaveLength(0);
            expect(result.edgesRemoved).toHaveLength(0);
            expect(result.edgesModified).toHaveLength(0);
            expect(result.edgesRenamed).toHaveLength(0);
            expect(result.nodesSame).toHaveLength(testArchitectures.baseArchitecture.nodes?.length ?? 0);
            expect(result.edgesSame).toHaveLength(testArchitectures.baseArchitecture.relationships?.length ?? 0);
        });

        it('should categorize changes correctly for rename scenario', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.renameArchitecture);

            // Renamed nodes should NOT appear in added/removed
            expect(result.nodesAdded).toHaveLength(0);
            expect(result.nodesRemoved).toHaveLength(0);
            expect(result.nodesRenamed).toHaveLength(1);
            expect(result.nodesRenamed[0].oldId).toBe('payment-service');
            expect(result.nodesRenamed[0].newId).toBe('payment-processor');

            // Relationships that reference renamed nodes are modified (destination changed)
            const gateway2payment = result.edgesModified.find((e) => e.original['unique-id'] === 'gateway-to-payment');
            expect(gateway2payment).toBeDefined();
        });
    });

    describe('diffArchitectures - summary stats', () => {
        it('should provide accurate counts for complex scenario', () => {
            const result = diffArchitectures(testArchitectures.baseArchitecture, testArchitectures.additionArchitecture);

            const totalAdded = result.nodesAdded.length + result.edgesAdded.length;
            const totalRemoved = result.nodesRemoved.length + result.edgesRemoved.length;
            const totalModified =
                result.nodesModified.length + result.edgesModified.length + result.nodesRenamed.length + result.edgesRenamed.length;

            expect(totalAdded).toBeGreaterThan(0);
            expect(totalRemoved).toBe(0);
            expect(totalModified).toBe(0);
        });
    });
});
