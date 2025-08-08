import {
    CalmRelationship,
    CalmInteractsType,
    CalmConnectsType,
    CalmDeployedInType,
    CalmComposedOfType,
    CalmOptionsRelationshipType,
    CalmDecisionType
} from './relationship.js';
import { CalmRelationshipSchema} from '../types/core-types.js';
import { CalmNodeInterface } from './interface.js';

describe('CalmRelationship (hibernate-model)', () => {
    it('should create a CalmRelationship instance from JSON data (interacts)', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-1',
            description: 'Interacts test',
            'relationship-type': {
                interacts: { actor: 'actor-1', nodes: ['node-1', 'node-2'] }
            },
            protocol: 'HTTP',
            metadata: [{ key: 'value' }],
            controls: { 'control-1': { description: 'desc', requirements: [{ 'requirement-url': 'url', 'config-url': 'cfg' }] } }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel).toBeInstanceOf(CalmRelationship);
        expect(rel.uniqueId).toBe('rel-1');
        expect(rel.description).toBe('Interacts test');
        expect(rel.protocol).toBe('HTTP');
        expect(rel.metadata).toBeDefined();
        expect(rel.controls).toBeDefined();
        expect(rel.relationshipType).toBeInstanceOf(CalmInteractsType);
        expect((rel.relationshipType as CalmInteractsType).actor).toBe('actor-1');
        expect((rel.relationshipType as CalmInteractsType).nodes).toEqual(['node-1', 'node-2']);
    });

    it('should create a CalmRelationship instance from JSON data (connects)', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-2',
            description: 'Connects test',
            'relationship-type': {
                connects: {
                    source: { node: 'node-1', interfaces: ['iface-1'] },
                    destination: { node: 'node-2', interfaces: ['iface-2'] }
                }
            },
            protocol: 'HTTPS'
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.relationshipType).toBeInstanceOf(CalmConnectsType);
        const rt = rel.relationshipType as CalmConnectsType;
        expect(rt.source).toBeInstanceOf(CalmNodeInterface);
        expect(rt.destination).toBeInstanceOf(CalmNodeInterface);
    });

    it('should create a CalmRelationship instance from JSON data (deployed-in)', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-3',
            'relationship-type': {
                'deployed-in': { container: 'container-1', nodes: ['node-1', 'node-2'] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.relationshipType).toBeInstanceOf(CalmDeployedInType);
        const rt = rel.relationshipType as CalmDeployedInType;
        expect(rt.container).toBe('container-1');
        expect(rt.nodes).toEqual(['node-1', 'node-2']);
    });

    it('should create a CalmRelationship instance from JSON data (composed-of)', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-4',
            'relationship-type': {
                'composed-of': { container: 'container-2', nodes: ['node-3', 'node-4'] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.relationshipType).toBeInstanceOf(CalmComposedOfType);
        const rt = rel.relationshipType as CalmComposedOfType;
        expect(rt.container).toBe('container-2');
        expect(rt.nodes).toEqual(['node-3', 'node-4']);
    });

    it('should create a CalmRelationship instance from JSON data (options)', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-5',
            'relationship-type': {
                options: [
                    { description: 'Option 1', nodes: ['n1'], relationships: ['r1'] },
                    { description: 'Option 2', nodes: ['n2'], relationships: ['r2'], controls: ['c2'], metadata: ['m2'] }
                ]
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.relationshipType).toBeInstanceOf(CalmOptionsRelationshipType);
        const rt = rel.relationshipType as CalmOptionsRelationshipType;
        expect(rt.options).toHaveLength(2);
        expect(rt.options[0]).toBeInstanceOf(CalmDecisionType);
        expect(rt.options[1].controls).toEqual(['c2']);
        expect(rt.options[1].metadata).toEqual(['m2']);
    });

    it('should throw for unknown relationship-type', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-6',
            'relationship-type': { unknown: { foo: 'bar' } }
        };
        expect(() => CalmRelationship.fromSchema(schema)).toThrow();
    });

    it('should support roundtrip fromSchema → toCanonicalSchema', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-7',
            description: 'Roundtrip',
            'relationship-type': {
                interacts: { actor: 'actor-7', nodes: ['node-7'] }
            },
            protocol: 'AMQP',
            metadata: [{ foo: 'bar' }],
            controls: { 'control-7': { description: 'desc', requirements: [{ 'requirement-url': 'url', 'config-url': 'cfg' }] } }
        };
        const rel = CalmRelationship.fromSchema(schema);
        const canonical = rel.toCanonicalSchema();
        expect(canonical['unique-id']).toBe('rel-7');
        expect(canonical['relationship-type']).toBeDefined();
        expect(canonical.protocol).toBe('AMQP');
        expect(canonical.controls).toBeDefined();
        expect(canonical.metadata).toBeDefined();
    });

    it('should support roundtrip fromSchema → toSchema', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-8',
            description: 'Roundtrip',
            'relationship-type': {
                interacts: { actor: 'actor-8', nodes: ['node-8'] }
            },
            protocol: 'AMQP',
            metadata: [{ foo: 'bar' }],
            controls: { 'control-8': { description: 'desc', requirements: [{ 'requirement-url': 'url', 'config-url': 'cfg' }] } }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.toSchema()).toEqual(schema);
    });

    it('should handle missing optional fields gracefully', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-9',
            'relationship-type': {
                interacts: { actor: 'actor-9', nodes: ['node-9'] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.uniqueId).toBe('rel-9');
        expect(rel.description).toBeUndefined();
        expect(rel.protocol).toBeUndefined();
        expect(rel.metadata).toBeUndefined();
        expect(rel.controls).toBeUndefined();
    });

    it('should handle empty nodes/relationships arrays', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-10',
            'relationship-type': {
                'deployed-in': { container: 'container-10', nodes: [] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.relationshipType).toBeInstanceOf(CalmDeployedInType);
        expect((rel.relationshipType as CalmDeployedInType).nodes).toEqual([]);
    });

    it('should handle multiple relationships of the same type', () => {
        const schemas: CalmRelationshipSchema[] = [
            {
                'unique-id': 'rel-11',
                'relationship-type': {
                    connects: { source: { node: 'n11a' }, destination: { node: 'n11b' } }
                }
            },
            {
                'unique-id': 'rel-12',
                'relationship-type': {
                    connects: { source: { node: 'n12a' }, destination: { node: 'n12b' } }
                }
            }
        ];
        const rels = schemas.map(s => CalmRelationship.fromSchema(s));
        expect(rels[0].relationshipType).toBeInstanceOf(CalmConnectsType);
        expect(rels[1].relationshipType).toBeInstanceOf(CalmConnectsType);
    });

    it('should produce the correct canonical model for interacts', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-canon-1',
            description: 'Interacts canonical',
            'relationship-type': {
                interacts: { actor: 'actor-canon', nodes: ['node-canon-1', 'node-canon-2'] }
            },
            protocol: 'HTTP',
            metadata: [{ key: 'meta' }],
            controls: { 'control-canon': { description: 'desc', requirements: [{ 'requirement-url': 'url', 'config-url': 'cfg' }] } }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.toCanonicalSchema()).toEqual({
            'unique-id': 'rel-canon-1',
            'relationship-type': { interacts: { actor: 'actor-canon', nodes: ['node-canon-1', 'node-canon-2'] } },
            'metadata': rel.metadata?.toCanonicalSchema(),
            'controls': rel.controls?.toCanonicalSchema(),
            'description': 'Interacts canonical',
            'protocol': 'HTTP'
        });
    });

    it('should produce the correct canonical model for connects', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-canon-2',
            description: 'Connects canonical',
            'relationship-type': {
                connects: {
                    source: { node: 'node-canon-1', interfaces: ['iface-1'] },
                    destination: { node: 'node-canon-2', interfaces: ['iface-2'] }
                }
            },
            protocol: 'HTTPS'
        };
        const rel: CalmRelationship = CalmRelationship.fromSchema(schema);
        expect(rel.toCanonicalSchema()).toEqual({
            'unique-id': 'rel-canon-2',
            'relationship-type': {
                connects: {
                    source: { node: 'node-canon-1', interfaces: ['iface-1'] },
                    destination: { node: 'node-canon-2', interfaces: ['iface-2'] }
                }
            },
            'metadata': undefined,
            'controls': undefined,
            'description': 'Connects canonical',
            'protocol': 'HTTPS'
        });
    });

    it('should produce the correct canonical model for deployed-in', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-canon-3',
            'relationship-type': {
                'deployed-in': { container: 'container-canon', nodes: ['node-canon-1', 'node-canon-2'] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.toCanonicalSchema()).toEqual({
            'unique-id': 'rel-canon-3',
            'relationship-type': { 'deployed-in': { container: 'container-canon', nodes: ['node-canon-1', 'node-canon-2'] } },
            'metadata': undefined,
            'controls': undefined,
            'description': undefined,
            'protocol': undefined
        });
    });

    it('should produce the correct canonical model for composed-of', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-canon-4',
            'relationship-type': {
                'composed-of': { container: 'container-canon', nodes: ['node-canon-3', 'node-canon-4'] }
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.toCanonicalSchema()).toEqual({
            'unique-id': 'rel-canon-4',
            'relationship-type': { 'composed-of': { container: 'container-canon', nodes: ['node-canon-3', 'node-canon-4'] } },
            'metadata': undefined,
            'controls': undefined,
            'description': undefined,
            'protocol': undefined
        });
    });

    it('should produce the correct canonical model for options', () => {
        const schema: CalmRelationshipSchema = {
            'unique-id': 'rel-canon-5',
            'relationship-type': {
                options: [
                    { description: 'Option 1', nodes: ['n1'], relationships: ['r1'] },
                    { description: 'Option 2', nodes: ['n2'], relationships: ['r2'], controls: ['c2'], metadata: ['m2'] }
                ]
            }
        };
        const rel = CalmRelationship.fromSchema(schema);
        expect(rel.toCanonicalSchema()).toEqual({
            'unique-id': 'rel-canon-5',
            'relationship-type': {
                options: [
                    { description: 'Option 1', nodes: ['n1'], relationships: ['r1'], controls: [], metadata: [] },
                    { description: 'Option 2', nodes: ['n2'], relationships: ['r2'], controls: ['c2'], metadata: ['m2'] }
                ]
            },
            'metadata': undefined,
            'controls': undefined,
            'description': undefined,
            'protocol': undefined
        });
    });
});
