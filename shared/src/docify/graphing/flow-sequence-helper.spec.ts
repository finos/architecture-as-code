import { FlowSequenceHelper } from './flow-sequence-helper';
import { Architecture, CalmCore } from '../../model/core';
import { CalmRelationship, CalmInteractsType, CalmConnectsType, CalmComposedOfType } from '../../model/relationship';
import { CalmMetadata } from '../../model/metadata';
import { CalmNode } from '../../model/node';
import { CalmNodeInterface } from '../../model/interface';
import { CalmFlowTransition } from '../../model/flow';

describe('FlowSequenceHelper', () => {
    let helper: FlowSequenceHelper;
    let architecture: Architecture;

    beforeEach(() => {
        helper = new FlowSequenceHelper();

        // Create test nodes
        const nodes = [
            new CalmNode('document-system', 'system', 'DocuFlow', 'Main document management system', undefined, undefined, undefined, new CalmMetadata({}), {}),
            new CalmNode('svc-upload', 'service', 'Upload Service', 'Handles user document uploads', undefined, undefined, undefined, new CalmMetadata({}), {}),
            new CalmNode('svc-storage', 'service', 'Storage Service', 'Stores and retrieves documents securely', undefined, undefined, undefined, new CalmMetadata({}), {}),
            new CalmNode('db-docs', 'database', 'Document Database', 'Stores metadata and document references', undefined, undefined, undefined, new CalmMetadata({}), {})
        ];

        // Create test relationships
        const relationships = [
            new CalmRelationship(
                'rel-upload-to-storage',
                new CalmConnectsType(
                    new CalmNodeInterface('svc-upload', []),
                    new CalmNodeInterface('svc-storage', [])
                ),
                new CalmMetadata({}),
                [],
                'Upload Service sends documents to Storage Service for long-term storage'
            ),
            new CalmRelationship(
                'rel-storage-to-db',
                new CalmConnectsType(
                    new CalmNodeInterface('svc-storage', []),
                    new CalmNodeInterface('db-docs', [])
                ),
                new CalmMetadata({}),
                [],
                'Storage Service stores document metadata in the Document Database'
            ),
            new CalmRelationship(
                'document-system-system-is-composed-of',
                new CalmComposedOfType('document-system', ['svc-upload', 'svc-storage', 'db-docs']),
                new CalmMetadata({}),
                [],
                'Document System contains services'
            ),
            new CalmRelationship(
                'test-interacts',
                new CalmInteractsType('actor1', ['service1']),
                new CalmMetadata({}),
                [],
                'Actor interacts with service'
            )
        ];

        // Create the architecture
        architecture = new CalmCore(nodes, relationships, new CalmMetadata({}), [], [], []);
    });

    describe('findRelationshipById', () => {
        it('should find a relationship by ID', () => {
            const relationship = helper.findRelationshipById('rel-upload-to-storage', architecture);
            expect(relationship).toBeDefined();
            expect(relationship?.uniqueId).toBe('rel-upload-to-storage');
        });

        it('should return undefined for non-existent relationship ID', () => {
            const relationship = helper.findRelationshipById('non-existent-id', architecture);
            expect(relationship).toBeUndefined();
        });
    });

    describe('getNodeNameById', () => {
        it('should get node name by ID', () => {
            const nodeName = helper.getNodeNameById('svc-upload', architecture);
            expect(nodeName).toBe('Upload Service');
        });

        it('should return undefined for non-existent node ID', () => {
            const nodeName = helper.getNodeNameById('non-existent-id', architecture);
            expect(nodeName).toBeUndefined();
        });
    });

    describe('getSourceFromRelationship', () => {
        it('should get source from a connects relationship', () => {
            const source = helper.getSourceFromRelationship('rel-upload-to-storage', architecture);
            expect(source).toBe('Upload Service');
        });

        it('should get source from a composed-of relationship', () => {
            const source = helper.getSourceFromRelationship('document-system-system-is-composed-of', architecture);
            expect(source).toBe('DocuFlow');
        });

        it('should get source from an interacts relationship', () => {
            const source = helper.getSourceFromRelationship('test-interacts', architecture);
            expect(source).toBe('actor1');
        });

        it('should return unknown for unsupported relationship type', () => {
            // Create a relationship with an unsupported type
            const unsupportedRel = new CalmRelationship(
                'unsupported-rel',
                { type: 'unsupported' } as unknown,
                new CalmMetadata({}),
                [],
                'Unsupported relationship type'
            );

            // Add it to the architecture
            architecture.relationships.push(unsupportedRel);

            const source = helper.getSourceFromRelationship('unsupported-rel', architecture);
            expect(source).toBe(FlowSequenceHelper.UNKNOWN_NODE);
        });
    });

    describe('getTargetFromRelationship', () => {
        it('should get target from a connects relationship', () => {
            const target = helper.getTargetFromRelationship('rel-upload-to-storage', architecture);
            expect(target).toBe('Storage Service');
        });

        it('should get target from a composed-of relationship', () => {
            // For composed-of relationships, the target is the first node in the nodes array
            const target = helper.getTargetFromRelationship('document-system-system-is-composed-of', architecture);
            expect(target).toBe('svc-upload');
        });

        it('should get target from an interacts relationship', () => {
            const target = helper.getTargetFromRelationship('test-interacts', architecture);
            expect(target).toBe('service1');
        });

        it('should return unknown for unsupported relationship type', () => {
            // Create a relationship with an unsupported type
            const unsupportedRel = new CalmRelationship(
                'unsupported-rel-target',
                { type: 'unsupported' } as unknown,
                new CalmMetadata({}),
                [],
                'Unsupported relationship type'
            );

            // Add it to the architecture
            architecture.relationships.push(unsupportedRel);

            const target = helper.getTargetFromRelationship('unsupported-rel-target', architecture);
            expect(target).toBe(FlowSequenceHelper.UNKNOWN_NODE);
        });
    });

    describe('transformFlowTransitions', () => {
        it('should transform flow transitions with source and target information', () => {
            const transitions: CalmFlowTransition[] = [
                new CalmFlowTransition(
                    'rel-upload-to-storage',
                    1,
                    'Upload Service sends documents to Storage Service',
                    'source-to-destination'
                ),
                new CalmFlowTransition(
                    'document-system-system-is-composed-of',
                    2,
                    'Document System contains services',
                    'source-to-destination'
                )
            ];


            const transformedTransitions = helper.transformFlowTransitions(transitions, architecture);

            expect(transformedTransitions).toHaveLength(2);

            // Check first transition
            expect(transformedTransitions[0].relationshipId).toBe('rel-upload-to-storage');
            expect(transformedTransitions[0].source).toBe('Upload Service');
            expect(transformedTransitions[0].target).toBe('Storage Service');

            // Check second transition
            expect(transformedTransitions[1].relationshipId).toBe('document-system-system-is-composed-of');
            expect(transformedTransitions[1].source).toBe('DocuFlow');
            expect(transformedTransitions[1].target).toBe('svc-upload');
        });
    });
});
