import { describe, it, expect, beforeEach } from 'vitest';
import { FlowSequenceHelper, orientEndpoints } from './flow-sequence-helper.js';
import { CalmCore, CalmFlowTransition } from '@finos/calm-models/model';
import type { Architecture } from '@finos/calm-models/model';

describe('FlowSequenceHelper', () => {
    let helper: FlowSequenceHelper;
    let architecture: Architecture;

    beforeEach(() => {
        helper = new FlowSequenceHelper();
        architecture = CalmCore.fromSchema({
            nodes: [
                { 'unique-id': 'svc-upload', 'node-type': 'service', name: 'Upload Service', description: '' },
                { 'unique-id': 'svc-storage', 'node-type': 'service', name: 'Storage Service', description: '' },
                { 'unique-id': 'db-docs', 'node-type': 'database', name: 'Document Database', description: '' },
                { 'unique-id': 'document-system', 'node-type': 'system', name: 'DocuFlow', description: '' },
            ],
            relationships: [
                { 'unique-id': 'upload-to-storage', 'relationship-type': { connects: { source: { node: 'svc-upload' }, destination: { node: 'svc-storage' } } } },
                { 'unique-id': 'actor-uses', 'relationship-type': { interacts: { actor: 'svc-upload', nodes: ['svc-storage', 'db-docs'] } } },
                { 'unique-id': 'system-composed', 'relationship-type': { 'composed-of': { container: 'document-system', nodes: ['svc-upload', 'svc-storage'] } } },
                { 'unique-id': 'deployed', 'relationship-type': { 'deployed-in': { container: 'document-system', nodes: ['db-docs'] } } },
            ],
        });
    });

    it('resolves connects source/target to node names', () => {
        expect(helper.getSourceFromRelationship('upload-to-storage', architecture)).toBe('Upload Service');
        expect(helper.getTargetFromRelationship('upload-to-storage', architecture)).toBe('Storage Service');
    });

    it('resolves interacts actor/first-node to names', () => {
        expect(helper.getSourceFromRelationship('actor-uses', architecture)).toBe('Upload Service');
        expect(helper.getTargetFromRelationship('actor-uses', architecture)).toBe('Storage Service');
    });

    it('resolves composed-of container/first-node to names', () => {
        expect(helper.getSourceFromRelationship('system-composed', architecture)).toBe('DocuFlow');
        expect(helper.getTargetFromRelationship('system-composed', architecture)).toBe('Upload Service');
    });

    it('resolves deployed-in container/first-node to names', () => {
        expect(helper.getSourceFromRelationship('deployed', architecture)).toBe('DocuFlow');
        expect(helper.getTargetFromRelationship('deployed', architecture)).toBe('Document Database');
    });

    it('returns UNKNOWN_NODE for a missing relationship', () => {
        expect(helper.getSourceFromRelationship('missing', architecture)).toBe(FlowSequenceHelper.UNKNOWN_NODE);
        expect(helper.getTargetFromRelationship('missing', architecture)).toBe(FlowSequenceHelper.UNKNOWN_NODE);
    });

    it('lists all participant node ids for each relationship kind', () => {
        expect(helper.getNodeIdsFromRelationship('upload-to-storage', architecture)).toEqual(['svc-upload', 'svc-storage']);
        expect(helper.getNodeIdsFromRelationship('actor-uses', architecture)).toEqual(['svc-upload', 'svc-storage', 'db-docs']);
        expect(helper.getNodeIdsFromRelationship('system-composed', architecture)).toEqual(['document-system', 'svc-upload', 'svc-storage']);
        expect(helper.getNodeIdsFromRelationship('deployed', architecture)).toEqual(['document-system', 'db-docs']);
    });

    it('returns an empty id list for a missing relationship', () => {
        expect(helper.getNodeIdsFromRelationship('missing', architecture)).toEqual([]);
    });

    it('transforms transitions with resolved source and target', () => {
        const transitions = [
            new CalmFlowTransition(
                { 'relationship-unique-id': 'upload-to-storage', 'sequence-number': 1, description: 'send', direction: 'source-to-destination' },
                'upload-to-storage', 1, 'send', 'source-to-destination'
            ),
        ];
        const [t] = helper.transformFlowTransitions(transitions, architecture);
        expect(t.relationshipId).toBe('upload-to-storage');
        expect(t.source).toBe('Upload Service');
        expect(t.target).toBe('Storage Service');
    });
});

describe('orientEndpoints', () => {
    it('keeps order for a forward transition', () => {
        expect(orientEndpoints('A', 'B', false)).toEqual(['A', 'B']);
    });

    it('swaps order for a return transition', () => {
        expect(orientEndpoints('A', 'B', true)).toEqual(['B', 'A']);
    });
});

