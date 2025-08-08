import { FlowSequenceHelper } from './flow-sequence-helper';
import { Architecture, CalmCore } from '../../model/core';
import { CalmNode } from '../../model/node';
import { CalmRelationship } from '../../model/relationship';
import { CalmFlowTransition } from '../../model/flow';

describe('FlowSequenceHelper', () => {
    let helper: FlowSequenceHelper;
    let architecture: Architecture;

    beforeEach(() => {
        helper = new FlowSequenceHelper();

        const nodes = [
            CalmNode.fromSchema({
                'unique-id': 'document-system',
                'node-type': 'system',
                name: 'DocuFlow',
                description: 'Main document management system',
                metadata: [{}]
            }),
            CalmNode.fromSchema({
                'unique-id': 'svc-upload',
                'node-type': 'service',
                name: 'Upload Service',
                description: 'Handles user document uploads',
                metadata: [{}]
            }),
            CalmNode.fromSchema({
                'unique-id': 'svc-storage',
                'node-type': 'service',
                name: 'Storage Service',
                description: 'Stores and retrieves documents securely',
                metadata: [{}]
            }),
            CalmNode.fromSchema({
                'unique-id': 'db-docs',
                'node-type': 'database',
                name: 'Document Database',
                description: 'Stores metadata and document references',
                metadata: [{}]
            })
        ];

        const relationships = [
            CalmRelationship.fromSchema({
                'unique-id': 'rel-upload-to-storage',
                description: 'Upload Service sends documents to Storage Service for long-term storage',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc-upload', interfaces: [] },
                        destination: { node: 'svc-storage', interfaces: [] }
                    }
                },
                metadata: [{}]
            }),
            CalmRelationship.fromSchema({
                'unique-id': 'rel-storage-to-db',
                description: 'Storage Service stores document metadata in the Document Database',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc-storage', interfaces: [] },
                        destination: { node: 'db-docs', interfaces: [] }
                    }
                },
                metadata: [{}]
            }),
            CalmRelationship.fromSchema({
                'unique-id': 'document-system-system-is-composed-of',
                description: 'Document System contains services',
                'relationship-type': {
                    'composed-of': { container: 'document-system', nodes: ['svc-upload', 'svc-storage', 'db-docs'] }
                },
                metadata: [{}]
            }),
            CalmRelationship.fromSchema({
                'unique-id': 'test-interacts',
                description: 'Actor interacts with service',
                'relationship-type': {
                    interacts: { actor: 'actor1', nodes: ['service1'] }
                },
                metadata: [{}]
            })
        ];

        architecture = CalmCore.fromSchema({
            nodes: nodes.map(n => n.toSchema()),
            relationships: relationships.map(r => r.toSchema()),
            metadata: [{}],
            flows: [],
            adrs: []
        });
    });

    describe('transformFlowTransitions', () => {
        it('should transform flow transitions with source and target information', () => {
            const transitions: CalmFlowTransition[] = [
                new CalmFlowTransition(
                    {
                        'relationship-unique-id': 'rel-upload-to-storage',
                        'sequence-number': 1,
                        description: 'Upload Service sends documents to Storage Service',
                        direction: 'source-to-destination'
                    },
                    'rel-upload-to-storage',
                    1,
                    'Upload Service sends documents to Storage Service',
                    'source-to-destination'
                ),
                new CalmFlowTransition(
                    {
                        'relationship-unique-id': 'document-system-system-is-composed-of',
                        'sequence-number': 2,
                        description: 'Document System contains services',
                        direction: 'source-to-destination'
                    },
                    'document-system-system-is-composed-of',
                    2,
                    'Document System contains services',
                    'source-to-destination'
                )
            ];

            const transformed = helper.transformFlowTransitions(transitions, architecture);

            expect(transformed).toHaveLength(2);

            expect(transformed[0].relationshipId).toBe('rel-upload-to-storage');
            expect(transformed[0].source).toBe('Upload Service');
            expect(transformed[0].target).toBe('Storage Service');

            expect(transformed[1].relationshipId).toBe('document-system-system-is-composed-of');
            expect(transformed[1].source).toBe('DocuFlow');
            expect(transformed[1].target).toBe('svc-upload');
        });
    });
});