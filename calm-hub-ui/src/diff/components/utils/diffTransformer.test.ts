import { describe, expect, it } from 'vitest';
import { parseCALMDataWithDiff } from './diffTransformer.js';
import { DiffResult } from '@finos/calm-models/diff';
import testArchitectures from '../../fixtures/diff-test-architectures.json' with { type: 'json' };

describe('diffTransformer', () => {
    it('should return base result when diffResult is null', () => {
        const data = testArchitectures.baseArchitecture;

        const result = parseCALMDataWithDiff(data, null, true);

        expect(result.nodes).toHaveLength(4);
        expect(result.nodes[0].data.diffStatus).toBeUndefined();
        expect(result.nodes[1].data.diffStatus).toBeUndefined();
        expect(result.nodes[2].data.diffStatus).toBeUndefined();
        expect(result.nodes[3].data.diffStatus).toBeUndefined();
    });

    it('should handle renamed nodes correctly', () => {
        const oldNodes = testArchitectures.baseArchitecture.nodes;
        const newNodes = testArchitectures.renameArchitecture.nodes;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [{ oldId: 'payment-service', newId: 'payment-processor', node: testArchitectures.baseArchitecture.nodes[0] }],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [...oldNodes, ...newNodes], relationships: [] },
            diffResult,
            true
        );
        expect(result.nodes).toHaveLength(8);
        expect(result.nodes.find(n => n.id === 'payment-service')?.data.diffStatus).toBe('unchanged');
        expect(result.nodes.find(n => n.id === 'payment-service')?.data.originalId).toBeUndefined();
        expect(result.nodes.find(n => n.id === 'payment-processor')?.data.diffStatus).toBe('renamed');
        expect(result.nodes.find(n => n.id === 'payment-processor')?.data.originalId).toBe('payment-service');
    });

    it('should handle added nodes correctly', () => {
        const oldNodes = testArchitectures.baseArchitecture.nodes;
        const newNodes = testArchitectures.additionArchitecture.nodes;
        const diffResult: DiffResult = {
            nodesAdded: [
                {
                    "unique-id": "audit-service",
                    "node-type": "service",
                    "name": "Audit Service",
                    "description": "Logs all payment transactions"
                }
            ],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [...oldNodes, ...newNodes], relationships: [] },
            diffResult,
            false // isFirst is false to test added nodes in the second architecture
        );
        expect(result.nodes).toHaveLength(9);
        expect(result.nodes.find(n => n.id === 'audit-service')?.data.diffStatus).toBe('added');
        //check styles
        expect(result.nodes.find(n => n.id === 'audit-service')?.style).toEqual({ boxShadow: '0 0 0 3px #16a34a', borderRadius: '12px' });
    });

    it('should handle modified nodes correctly', () => {
        const oldNodes = testArchitectures.baseArchitecture.nodes;
        const newNodes = testArchitectures.modificationArchitecture.nodes;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [{ 
                original: {
                    "unique-id": "api-gateway",
                    "node-type": "system",
                    "name": "API Gateway",
                    "description": "Entry point for all API requests"
                }, 
                updated: {
                    "unique-id": "api-gateway",
                    "node-type": "system",
                    "name": "API Gateway v2",
                    "description": "Entry point for all API requests - upgraded"
                } 
            }],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [...oldNodes, ...newNodes], relationships: [] },
            diffResult,
            true
        );
        expect(result.nodes).toHaveLength(8);
        expect(result.nodes.find(n => n.id === 'api-gateway')?.data.diffStatus).toBe('modified');
        //check styles
        // Diff highlight is merged on top of the main viewer's node styling (preserved).
        expect(result.nodes.find(n => n.id === 'api-gateway')?.style).toMatchObject({ boxShadow: '0 0 0 3px #d97706', borderRadius: '12px' });
    });

    it('should handle unchanged nodes correctly', () => {
        const oldNodes = testArchitectures.baseArchitecture.nodes;
        const newNodes = testArchitectures.baseArchitecture.nodes;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [
                {
                    "unique-id": "api-gateway",
                    "node-type": "system",
                    "name": "API Gateway",
                    "description": "Entry point for all API requests"
                },
                {
                    "unique-id": "payment-service",
                    "node-type": "service",
                    "name": "Payment Service",
                    "description": "Handles payment processing"
                },
                {
                    "unique-id": "user-db",
                    "node-type": "database",
                    "name": "User Database",
                    "description": "Stores user information"
                },
                {
                    "unique-id": "trader",
                    "node-type": "actor",
                    "name": "Trader",
                    "description": "Human user"
                }
            ],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [...oldNodes, ...newNodes], relationships: [] },
            diffResult,
            true
        );
        expect(result.nodes).toHaveLength(8);
        expect(result.nodes.find(n => n.id === 'api-gateway')?.data.diffStatus).toBe('unchanged');
        expect(result.nodes.find(n => n.id === 'payment-service')?.data.diffStatus).toBe('unchanged');
        expect(result.nodes.find(n => n.id === 'user-db')?.data.diffStatus).toBe('unchanged');
        expect(result.nodes.find(n => n.id === 'trader')?.data.diffStatus).toBe('unchanged');
        // Unchanged nodes carry no diff highlight (their base styling is left untouched).
        expect(result.nodes.find(n => n.id === 'api-gateway')?.style?.boxShadow).toBeUndefined();
        expect(result.nodes.find(n => n.id === 'payment-service')?.style?.boxShadow).toBeUndefined();
        expect(result.nodes.find(n => n.id === 'user-db')?.style?.boxShadow).toBeUndefined();
        expect(result.nodes.find(n => n.id === 'trader')?.style?.boxShadow).toBeUndefined();
    });

    it('should handle nodes removed correctly', () => {
        const oldNodes = testArchitectures.baseArchitecture.nodes;
        const newNodes = testArchitectures.removalArchitecture.nodes;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [
                {
                "unique-id": "user-db",
                "node-type": "database",
                "name": "User Database",
                "description": "Stores user information"
            },
            ],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [...oldNodes, ...newNodes], relationships: [] },
            diffResult,
            true
        );
        expect(result.nodes).toHaveLength(7);
        expect(result.nodes.find(n => n.id === 'user-db')?.data.diffStatus).toBe('removed');
        //check styles
        expect(result.nodes.find(n => n.id === 'user-db')?.style).toEqual({ boxShadow: '0 0 0 3px #dc2626', borderRadius: '12px', opacity: 0.6 });
    });

    it('should handle empty nodes correctly', () => {
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };

        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [] },
            diffResult,
            true
        );
        expect(result.nodes).toHaveLength(0);
    });

    it('should handle edges added correctly', () => {
        const oldEdges = testArchitectures.baseArchitecture.relationships;
        const newEdges = testArchitectures.additionArchitecture.relationships;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [
                {
                    "unique-id": "payment-to-audit",
                    "description": "Payment service sends events to audit",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "payment-service" },
                        "destination": { "node": "audit-service" }
                    }
                    }
                }
            ],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [ ...oldEdges, ...newEdges ] },
            diffResult,
            false // isFirst is false to test added edges in the second architecture
        );
        expect(result.edges).toHaveLength(7);
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-audit')?.data.diffStatus).toBe('added');
        //check styles
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-audit')?.style).toEqual({ stroke: '#16a34a', strokeWidth: 3 });
    });

    it('should handle edges removed correctly', () => {
        const oldEdges = testArchitectures.baseArchitecture.relationships;
        const newEdges = testArchitectures.removalArchitecture.relationships;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [
                {
                    "unique-id": "payment-to-db",
                    "description": "Payment service stores data",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "payment-service" },
                        "destination": { "node": "user-db" }
                    }
                    }
                }
            ],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [...oldEdges, ...newEdges] },
            diffResult,
            true
        );
        expect(result.edges).toHaveLength(5);
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-db')?.data.diffStatus).toBe('removed');
        //check styles
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-db')?.style).toEqual({ stroke: '#dc2626', strokeWidth: 3, opacity: 0.6 });
    });

    it('should handle edges modified correctly', () => {
        const oldEdges = testArchitectures.baseArchitecture.relationships;
        const newEdges = testArchitectures.relationshipModificationArchitecture.relationships;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [{ 
                original: {
                    "unique-id": "gateway-to-payment",
                    "description": "Gateway routes to payment service",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "api-gateway" },
                        "destination": { "node": "payment-service" }
                    }
                    }
                }, 
                updated: {
                    "unique-id": "gateway-to-payment",
                    "description": "Gateway routes to payment service (modified)",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "api-gateway" },
                        "destination": { "node": "payment-service" }
                    }
                    }
                }, 
            }],
            edgesRenamed: [],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [...oldEdges, ...newEdges] },
            diffResult,
            true
        );
        expect(result.edges).toHaveLength(6);
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.data.diffStatus).toBe('modified');
        //check styles
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.style).toEqual({ stroke: '#d97706', strokeWidth: 3 });
    });

    it('should handle edges renamed correctly', () => {
        const oldEdges = testArchitectures.baseArchitecture.relationships;
        const newEdges = testArchitectures.relationshipRenameArchitecture.relationships;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [{ 
                oldId: 'gateway-to-payment', 
                newId: 'gateway-to-payment-renamed',
                relationship: {
                    "unique-id": "gateway-to-payment-renamed",
                    "description": "Gateway routes to payment service",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "api-gateway" },
                        "destination": { "node": "payment-service" }
                    }
                    }
                },  
            }],
            edgesSame: [],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [...oldEdges, ...newEdges] },
            diffResult,
            true
        );
        expect(result.edges).toHaveLength(6);
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.data.diffStatus).toBe('unchanged');
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.data.originalId).toBeUndefined();
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment-renamed')?.data.diffStatus).toBe('renamed');
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment-renamed')?.data.originalId).toBe('gateway-to-payment');
        //check styles
        // Unchanged edge keeps the main viewer's base styling; renamed edge is recoloured.
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.style).toEqual({ stroke: '#007dff', strokeWidth: 2.5 });
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment-renamed')?.style).toEqual({ stroke: '#6366f1', strokeWidth: 3 });
    });

    it('should handle edges unchanged correctly', () => {
        const oldEdges = testArchitectures.baseArchitecture.relationships;
        const newEdges = testArchitectures.baseArchitecture.relationships;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesRenamed: [],
            nodesSame: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesRenamed: [],
            edgesSame: [
                {
                    "unique-id": "trader-to-gateway",
                    "description": "Trader accesses API",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "trader" },
                        "destination": { "node": "api-gateway" }
                    }
                    }
                },
                {
                    "unique-id": "gateway-to-payment",
                    "description": "Gateway routes to payment service",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "api-gateway" },
                        "destination": { "node": "payment-service" }
                    }
                    }
                },
                {
                    "unique-id": "payment-to-db",
                    "description": "Payment service stores data",
                    "relationship-type": {
                    "connects": {
                        "source": { "node": "payment-service" },
                        "destination": { "node": "user-db" }
                    }
                    }
                }
            ],
        };
        const result = parseCALMDataWithDiff(
            { nodes: [], relationships: [...oldEdges, ...newEdges] },
            diffResult,
            true
        );
        expect(result.edges).toHaveLength(6);
        expect(result.edges.find(e => e.data?.['unique-id'] === 'trader-to-gateway')?.data.diffStatus).toBe('unchanged');
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.data.diffStatus).toBe('unchanged');
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-db')?.data.diffStatus).toBe('unchanged');
        // Unchanged edges retain the main viewer's base styling (no diff recolouring).
        expect(result.edges.find(e => e.data?.['unique-id'] === 'trader-to-gateway')?.style).toEqual({ stroke: '#007dff', strokeWidth: 2.5 });
        expect(result.edges.find(e => e.data?.['unique-id'] === 'gateway-to-payment')?.style).toEqual({ stroke: '#007dff', strokeWidth: 2.5 });
        expect(result.edges.find(e => e.data?.['unique-id'] === 'payment-to-db')?.style).toEqual({ stroke: '#007dff', strokeWidth: 2.5 });
    });
});