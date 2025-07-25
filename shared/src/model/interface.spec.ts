import {
    CalmInterface,
    CalmInterfaceDefinition,
    CalmInterfaceType,
    CalmNodeInterface
} from './interface.js';

describe('CalmInterface.fromJson', () => {
    describe('when both definition-url and config are present', () => {
        it('returns a CalmInterfaceDefinition with the correct fields', () => {
            const defData = {
                'unique-id': 'def-123',
                'definition-url': 'https://example.com/schema.json',
                config: { alpha: true, threshold: 5 }
            };

            const iface = CalmInterface.fromJson(defData);
            expect(iface).toBeInstanceOf(CalmInterfaceDefinition);

            // Narrow via instanceof so TypeScript recognizes the subclass
            if (!(iface instanceof CalmInterfaceDefinition)) {
                throw new Error('Expected CalmInterfaceDefinition');
            }
            expect(iface.uniqueId).toBe('def-123');
            expect(iface.interfaceDefinitionUrl).toBe('https://example.com/schema.json');
            expect(iface.configuration).toEqual({ alpha: true, threshold: 5 });
        });
    });

    describe('when only one of definition-url or config is present', () => {
        it('returns a CalmInterfaceType when only definition-url is present', () => {
            const bad = {
                'unique-id': 'bad-001',
                'definition-url': 'https://example.com/schema.json'
            };
            const iface = CalmInterface.fromJson(bad);
            expect(iface).toBeInstanceOf(CalmInterfaceType);

            if (!(iface instanceof CalmInterfaceType)) {
                throw new Error('Expected CalmInterfaceType');
            }
            expect(iface.uniqueId).toBe('bad-001');
            expect(iface.additionalProperties).toEqual({ 'definition-url': 'https://example.com/schema.json' });
        });

        it('returns a CalmInterfaceType when only config is present', () => {
            const bad = {
                'unique-id': 'bad-002',
                config: { foo: 'bar' }
            };
            const iface = CalmInterface.fromJson(bad);
            expect(iface).toBeInstanceOf(CalmInterfaceType);

            if (!(iface instanceof CalmInterfaceType)) {
                throw new Error('Expected CalmInterfaceType');
            }
            expect(iface.uniqueId).toBe('bad-002');
            expect(iface.additionalProperties).toEqual({ config: { foo: 'bar' } });
        });
    });

    describe('when both definition-url and config are present plus other properties', () => {
        it('returns a CalmInterfaceType with the correct fields', () => {
            const defData = {
                'unique-id': 'def-123',
                'definition-url': 'https://example.com/schema.json',
                config: { alpha: true, threshold: 5 },
                extraField: 'extraValue'
            };

            const iface = CalmInterface.fromJson(defData);
            expect(iface).toBeInstanceOf(CalmInterfaceType);

            // Narrow via instanceof so TypeScript recognizes the subclass
            if (!(iface instanceof CalmInterfaceType)) {
                throw new Error('Expected CalmInterfaceType');
            }
            expect(iface.uniqueId).toBe('def-123');
            expect(iface.additionalProperties).toEqual({
                'definition-url': 'https://example.com/schema.json',
                config: { alpha: true, threshold: 5 },
                extraField: 'extraValue'
            });
        });
    });

    describe('when neither definition-url nor config is present', () => {
        it('returns a CalmInterfaceType with any extra properties', () => {
            const typeData = {
                'unique-id': 'type-123',
                foo: 'bar',
                count: 42
            };
            const iface = CalmInterface.fromJson(typeData);
            expect(iface).toBeInstanceOf(CalmInterfaceType);

            if (!(iface instanceof CalmInterfaceType)) {
                throw new Error('Expected CalmInterfaceType');
            }
            expect(iface.uniqueId).toBe('type-123');
            expect(iface.additionalProperties).toEqual({ foo: 'bar', count: 42 });
        });
    });
});

describe('CalmNodeInterface.fromJson', () => {
    it('creates a node interface with an array of strings', () => {
        const data = {
            node: 'NodeA',
            interfaces: ['if1', 'if2']
        };
        const ni = CalmNodeInterface.fromJson(data);
        expect(ni).toBeInstanceOf(CalmNodeInterface);
        expect(ni.node).toBe('NodeA');
        expect(ni.interfaces).toEqual(['if1', 'if2']);
    });

    it('defaults interfaces to an empty array when missing', () => {
        const data = { node: 'NodeB' };
        const ni = CalmNodeInterface.fromJson(data);
        expect(ni.interfaces).toEqual([]);
    });
});
