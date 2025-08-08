import {
    CalmInterface,
    CalmInterfaceDefinition,
    CalmInterfaceType,
    CalmNodeInterface
} from './interface.js';
import {
    CalmInterfaceDefinitionSchema,
    CalmInterfaceTypeSchema,
    CalmNodeInterfaceSchema
} from '../types/interface-types.js';

describe('CalmInterfaceDefinition', () => {
    const definitionSchema: CalmInterfaceDefinitionSchema = {
        'unique-id': 'def-1',
        'definition-url': 'https://example.com/iface-def',
        config: { foo: 'bar', enabled: true },
    };

    it('should create from schema', () => {
        const def = CalmInterfaceDefinition.fromSchema(definitionSchema);
        expect(def).toBeInstanceOf(CalmInterfaceDefinition);
        expect(def.uniqueId).toBe('def-1');
        expect(def.definitionUrl.reference).toBe('https://example.com/iface-def');
        expect(def.config).toEqual({ foo: 'bar', enabled: true });
    });

    it('should produce the correct canonical model', () => {
        const def = CalmInterfaceDefinition.fromSchema(definitionSchema);
        expect(def.toCanonicalSchema()).toEqual({
            'unique-id': 'def-1',
            'definition-url': def.definitionUrl.reference,
            foo: 'bar',
            enabled: true
        });
    });

    it('should return the original schema with toSchema()', () => {
        const def = CalmInterfaceDefinition.fromSchema(definitionSchema);
        expect(def.toSchema()).toEqual(definitionSchema);
    });
});

describe('CalmInterfaceType', () => {
    const typeSchema: CalmInterfaceTypeSchema = {
        'unique-id': 'type-1',
        url: 'https://example.com/iface-type',
        port: 8080,
        extra: 'extra-type'
    };

    it('should create from schema', () => {
        const type = CalmInterfaceType.fromSchema(typeSchema);
        expect(type).toBeInstanceOf(CalmInterfaceType);
        expect(type.uniqueId).toBe('type-1');
        expect(type.originalJson.url).toBe('https://example.com/iface-type');
        expect(type.originalJson.port).toBe(8080);
        expect(type.originalJson.extra).toBe('extra-type');
    });

    it('should produce the correct canonical model', () => {
        const type = CalmInterfaceType.fromSchema(typeSchema);
        expect(type.toCanonicalSchema()).toEqual({
            'unique-id': 'type-1',
            url: 'https://example.com/iface-type',
            port: 8080,
            extra: 'extra-type'
        });
    });

    it('should return the original schema with toSchema()', () => {
        const type = CalmInterfaceType.fromSchema(typeSchema);
        expect(type.toSchema()).toEqual(typeSchema);
    });
});

describe('CalmInterface (type detection)', () => {
    it('should instantiate CalmInterfaceDefinition for definition schema', () => {
        const schema: CalmInterfaceDefinitionSchema = {
            'unique-id': 'def-2',
            'definition-url': 'https://example.com/iface-def2',
            config: { foo: 'baz' }
        };
        const iface = CalmInterface.fromSchema(schema);
        expect(iface).toBeInstanceOf(CalmInterfaceDefinition);
    });

    it('should instantiate CalmInterfaceType for type schema', () => {
        const schema: CalmInterfaceTypeSchema = {
            'unique-id': 'type-2',
            url: 'https://example.com/iface-type2'
        };
        const iface = CalmInterface.fromSchema(schema);
        expect(iface).toBeInstanceOf(CalmInterfaceType);
    });
});

describe('CalmNodeInterface', () => {
    const nodeIfaceSchema: CalmNodeInterfaceSchema = {
        node: 'node-1',
        interfaces: ['iface-1', 'iface-2']
    };

    it('should create from schema', () => {
        const ni = CalmNodeInterface.fromSchema(nodeIfaceSchema);
        expect(ni).toBeInstanceOf(CalmNodeInterface);
        expect(ni.node).toBe('node-1');
        expect(ni.interfaces).toEqual(['iface-1', 'iface-2']);
    });

    it('should produce the correct canonical model', () => {
        const ni = CalmNodeInterface.fromSchema(nodeIfaceSchema);
        expect(ni.toCanonicalSchema()).toEqual({
            node: 'node-1',
            interfaces: ['iface-1', 'iface-2']
        });
    });

    it('should return the original schema with toSchema()', () => {
        const ni = CalmNodeInterface.fromSchema(nodeIfaceSchema);
        expect(ni.toSchema()).toEqual(nodeIfaceSchema);
    });

    it('should default interfaces to empty array if not provided', () => {
        const schema: CalmNodeInterfaceSchema = { node: 'node-2' };
        const ni = CalmNodeInterface.fromSchema(schema);
        expect(ni.interfaces).toBeUndefined();
        expect(ni.toCanonicalSchema()).toEqual({ node: 'node-2'});
    });
});

describe('CalmInterface error/edge cases', () => {

    it('should work with minimal valid definition schema', () => {
        const schema: CalmInterfaceDefinitionSchema = {
            'unique-id': 'def-min',
            'definition-url': 'url',
            config: {}
        };
        const def = CalmInterfaceDefinition.fromSchema(schema);
        expect(def.uniqueId).toBe('def-min');
        expect(def.definitionUrl.reference).toBe('url');
        expect(def.config).toEqual({});
    });

    it('should work with minimal valid type schema', () => {
        const schema: CalmInterfaceTypeSchema = {
            'unique-id': 'type-min'
        };
        const type = CalmInterfaceType.fromSchema(schema);
        expect(type.uniqueId).toBe('type-min');
        expect(type.originalJson['unique-id']).toBe('type-min');
    });
});

