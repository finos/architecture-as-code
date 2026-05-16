import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import testArchitectures from '../../fixtures/diff-test-architectures.json' with { type: 'json' };
import { DiffPanel } from './DiffPanel.js';
import { DiffResult } from '../../model/diff.js';

describe('DiffPanel', () => {
    it('should display a message when the diff result is null', () => {
        render(
            <DiffPanel
                diffResult={null}
            />
        );

        expect(screen.getByText('Diff Summary')).toBeInTheDocument();
        expect(screen.getByText('Upload two CALM architecture files to see the differences.')).toBeInTheDocument();
    });

    it('should handle renamed nodes correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Nodes Renamed (1)')).toBeInTheDocument();
        expect(screen.getByText('payment-service → payment-processor (system)')).toBeInTheDocument();
    });

    it('should handle added nodes correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Nodes Added (1)')).toBeInTheDocument();
        expect(screen.getByText('Audit Service (service)')).toBeInTheDocument();
    });

    it('should handle modified nodes correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Nodes Modified (1)')).toBeInTheDocument();
        expect(screen.getByText('API Gateway (system)')).toBeInTheDocument();
    });

    it('should handle unchanged nodes correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Unchanged Nodes (4)')).toBeInTheDocument();
        expect(screen.getByText('API Gateway (system)')).toBeInTheDocument();
        expect(screen.getByText('Payment Service (service)')).toBeInTheDocument();
        expect(screen.getByText('User Database (database)')).toBeInTheDocument();
        expect(screen.getByText('Trader (actor)')).toBeInTheDocument();
    });

    it('should handle nodes removed correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Nodes Removed (1)')).toBeInTheDocument();
        expect(screen.getByText('User Database (database)')).toBeInTheDocument();
    });

    it('should handle edges added correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Relationships Added (1)')).toBeInTheDocument();
        expect(screen.getByText('payment-to-audit (connects)')).toBeInTheDocument();
    });

    it('should handle edges removed correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Relationships Removed (1)')).toBeInTheDocument();
        expect(screen.getByText('payment-to-db (connects)')).toBeInTheDocument();
    });

    it('should handle edges modified correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Relationships Modified (1)')).toBeInTheDocument();
        expect(screen.getByText('gateway-to-payment (connects)')).toBeInTheDocument();
    });

    it('should handle edges renamed correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Relationships Renamed (1)')).toBeInTheDocument();
        expect(screen.getByText('gateway-to-payment → gateway-to-payment-renamed (connects)')).toBeInTheDocument();
    });

    it('should handle edges unchanged correctly', () => {
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

        render(
            <DiffPanel
                diffResult={diffResult}
            />
        );

        expect(screen.getByText('Unchanged Relationships (3)')).toBeInTheDocument();
        expect(screen.getByText('trader-to-gateway (connects)')).toBeInTheDocument();
        expect(screen.getByText('gateway-to-payment (connects)')).toBeInTheDocument();
        expect(screen.getByText('payment-to-db (connects)')).toBeInTheDocument();
    });
});

    

    