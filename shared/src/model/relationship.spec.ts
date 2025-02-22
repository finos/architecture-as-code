import { CalmRelationship, CalmInteractsType, CalmConnectsType, CalmDeployedInType, CalmComposedOfType } from './relationship.js';
import { CalmRelationshipSchema } from '../types/core-types.js';
import { CalmNodeInterface } from './interface.js';

const relationshipData: CalmRelationshipSchema = {
    'unique-id': 'relationship-001',
    description: 'Test Relationship',
    'relationship-type': {
        interacts: {
            actor: 'actor-001',
            nodes: ['node-001', 'node-002']
        }
    },
    protocol: 'HTTP',
    authentication: 'OAuth2',
    metadata: [{ key: 'value' }],
    controls: { 'control-001': { description: 'Test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement', 'control-config-url': 'https://example.com/config' }] } }
};

describe('CalmRelationship', () => {
    it('should create a CalmRelationship instance from JSON data', () => {
        const relationship = CalmRelationship.fromJson(relationshipData);

        expect(relationship).toBeInstanceOf(CalmRelationship);
        expect(relationship.uniqueId).toBe('relationship-001');
        expect(relationship.description).toBe('Test Relationship');
        expect(relationship.protocol).toBe('HTTP');
        expect(relationship.authentication).toBe('OAuth2');
        expect(relationship.metadata).toEqual({ data: { key: 'value' } });
        expect(relationship.controls).toHaveLength(1);
        expect(relationship.controls[0].controlId).toBe('control-001');
        expect(relationship.relationshipType).toBeInstanceOf(CalmInteractsType);

        const interactsRelationship = relationship.relationshipType as CalmInteractsType;

        expect(interactsRelationship.actor).toBe('actor-001');
        expect(interactsRelationship.nodes).toEqual(['node-001', 'node-002']);
    });

    it('should handle a CalmConnectsType relationship type correctly', () => {
        const connectsRelationshipData: CalmRelationshipSchema = {
            'unique-id': 'relationship-002',
            description: 'Connects Relationship',
            'relationship-type': {
                connects: {
                    source: { 'node': 'node-001', interfaces: ['interface-001'] },
                    destination: { 'node': 'node-002', interfaces: ['interface-002'] }
                }
            },
            protocol: 'TLS',
            authentication: 'Basic',
            metadata: [{ key: 'value2' }],
            controls: { 'control-002': { description: 'Another test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement2', 'control-config-url': 'https://example.com/config2' }] } }
        };

        const relationship = CalmRelationship.fromJson(connectsRelationshipData);

        expect(relationship).toBeInstanceOf(CalmRelationship);
        expect(relationship.relationshipType).toBeInstanceOf(CalmConnectsType);

        const connectsRelationship = relationship.relationshipType as CalmConnectsType;
        expect(connectsRelationship.source).toBeInstanceOf(CalmNodeInterface);
        expect(connectsRelationship.destination).toBeInstanceOf(CalmNodeInterface);
    });

    it('should handle a CalmDeployedInType relationship type correctly', () => {
        const deployedInRelationshipData: CalmRelationshipSchema = {
            'unique-id': 'relationship-003',
            description: 'Deployed In Relationship',
            'relationship-type': {
                'deployed-in': {
                    container: 'container-001',
                    nodes: ['node-001', 'node-002']
                }
            },
            protocol: 'AMQP',
            authentication: 'Certificate',
            metadata: [{ key: 'value3' }],
            controls: { 'control-003': { description: 'Test control 3', requirements: [{ 'control-requirement-url': 'https://example.com/requirement3', 'control-config-url': 'https://example.com/config3' }] } }
        };

        const relationship = CalmRelationship.fromJson(deployedInRelationshipData);

        expect(relationship).toBeInstanceOf(CalmRelationship);
        expect(relationship.relationshipType).toBeInstanceOf(CalmDeployedInType);

        const deployedInRelationship = relationship.relationshipType as CalmDeployedInType;
        expect(deployedInRelationship.container).toBe('container-001');
        expect(deployedInRelationship.nodes).toEqual(['node-001', 'node-002']);
    });

    it('should handle a CalmComposedOfType relationship type correctly', () => {
        const composedOfRelationshipData: CalmRelationshipSchema = {
            'unique-id': 'relationship-004',
            description: 'Composed Of Relationship',
            'relationship-type': {
                'composed-of': {
                    container: 'container-002',
                    nodes: ['node-003', 'node-004']
                }
            },
            protocol: 'TCP',
            authentication: 'OAuth2',
            metadata: [{ key: 'value4' }],
            controls: { 'control-004': { description: 'Test control 4', requirements: [{ 'control-requirement-url': 'https://example.com/requirement4', 'control-config-url': 'https://example.com/config4' }] } }
        };

        const relationship = CalmRelationship.fromJson(composedOfRelationshipData);

        expect(relationship).toBeInstanceOf(CalmRelationship);
        expect(relationship.relationshipType).toBeInstanceOf(CalmComposedOfType);

        const composedOfRelationship = relationship.relationshipType as CalmDeployedInType;
        expect(composedOfRelationship.container).toBe('container-002');
        expect(composedOfRelationship.nodes).toEqual(['node-003', 'node-004']);
    });
});
