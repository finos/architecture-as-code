import { FlowSequenceHelper } from './flow-sequence-helper';
import { Architecture, CalmCore, CalmNode, CalmRelationship, CalmFlowTransition } from '@finos/calm-models/model';

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

    const mkTransition = (relId: string): CalmFlowTransition =>
        new CalmFlowTransition(
            {
                'relationship-unique-id': relId,
                'sequence-number': 1,
                description: '',
                direction: 'source-to-destination',
            },
            relId,
            1,
            '',
            'source-to-destination'
        );

    describe('getSourceFromRelationship', () => {
        it('returns the actor name for interacts relationships, falling back to the actor id', () => {
            const knownActor = CalmRelationship.fromSchema({
                'unique-id': 'rel-known',
                description: '',
                'relationship-type': { interacts: { actor: 'svc-upload', nodes: ['svc-storage'] } },
                metadata: [{}],
            });
            architecture.relationships.push(knownActor);
            expect(helper.getSourceFromRelationship('rel-known', architecture)).toBe('Upload Service');

            expect(helper.getSourceFromRelationship('test-interacts', architecture)).toBe('actor1');
        });

        it('returns UNKNOWN_NODE when the relationship cannot be found', () => {
            expect(helper.getSourceFromRelationship('missing', architecture)).toBe(
                FlowSequenceHelper.UNKNOWN_NODE
            );
        });

        it('returns UNKNOWN_NODE when the relationship kind is unrecognised', () => {
            const optionsRel = CalmRelationship.fromSchema({
                'unique-id': 'rel-options',
                description: '',
                'relationship-type': {
                    options: [{ description: 'opt', nodes: [], relationships: [] }],
                },
                metadata: [{}],
            });
            architecture.relationships.push(optionsRel);
            expect(helper.getSourceFromRelationship('rel-options', architecture)).toBe(
                FlowSequenceHelper.UNKNOWN_NODE
            );
        });
    });

    describe('getTargetFromRelationship', () => {
        it('returns the first interacts node name, falling back to the node id', () => {
            const knownTarget = CalmRelationship.fromSchema({
                'unique-id': 'rel-target-known',
                description: '',
                'relationship-type': { interacts: { actor: 'a', nodes: ['svc-storage'] } },
                metadata: [{}],
            });
            architecture.relationships.push(knownTarget);
            expect(helper.getTargetFromRelationship('rel-target-known', architecture)).toBe('Storage Service');

            // test-interacts has nodes: ['service1'] which is not in nodes — fall back to id
            expect(helper.getTargetFromRelationship('test-interacts', architecture)).toBe('service1');
        });

        it('falls back to empty string when interacts.nodes is empty', () => {
            const emptyInteracts = CalmRelationship.fromSchema({
                'unique-id': 'rel-empty-interacts',
                description: '',
                'relationship-type': { interacts: { actor: 'a', nodes: [] } },
                metadata: [{}],
            });
            architecture.relationships.push(emptyInteracts);
            expect(helper.getTargetFromRelationship('rel-empty-interacts', architecture)).toBe('');
        });

        it('returns the connects destination node, falling back to the node id', () => {
            // existing test covers happy path; this exercises fallback when destination node is not in arch.nodes
            const unknown = CalmRelationship.fromSchema({
                'unique-id': 'rel-unknown-dest',
                description: '',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc-upload', interfaces: [] },
                        destination: { node: 'no-such-node', interfaces: [] },
                    },
                },
                metadata: [{}],
            });
            architecture.relationships.push(unknown);
            expect(helper.getTargetFromRelationship('rel-unknown-dest', architecture)).toBe('no-such-node');
        });

        it('returns the first composed-of node or empty string', () => {
            expect(helper.getTargetFromRelationship('document-system-system-is-composed-of', architecture)).toBe('svc-upload');
        });

        it('returns UNKNOWN_NODE for missing relationship or unsupported kind', () => {
            expect(helper.getTargetFromRelationship('missing', architecture)).toBe(
                FlowSequenceHelper.UNKNOWN_NODE
            );

            const optionsRel = CalmRelationship.fromSchema({
                'unique-id': 'rel-options-t',
                description: '',
                'relationship-type': {
                    options: [{ description: 'opt', nodes: [], relationships: [] }],
                },
                metadata: [{}],
            });
            architecture.relationships.push(optionsRel);
            expect(helper.getTargetFromRelationship('rel-options-t', architecture)).toBe(
                FlowSequenceHelper.UNKNOWN_NODE
            );
        });
    });

    describe('getNodeNameById', () => {
        it('returns undefined when the node is not present', () => {
            expect(helper.getNodeNameById('not-present', architecture)).toBeUndefined();
        });
    });

    describe('transformFlowTransitions', () => {
        it('transforms a mixed set of transitions including unknowns', () => {
            const transformed = helper.transformFlowTransitions(
                [
                    mkTransition('rel-upload-to-storage'),
                    mkTransition('does-not-exist'),
                ],
                architecture
            );
            expect(transformed).toHaveLength(2);
            expect(transformed[1].source).toBe(FlowSequenceHelper.UNKNOWN_NODE);
            expect(transformed[1].target).toBe(FlowSequenceHelper.UNKNOWN_NODE);
        });

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