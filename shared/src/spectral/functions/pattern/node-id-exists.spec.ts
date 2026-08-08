import { asContext } from '../spectral-test-helpers';
import nodeIdExists from './node-id-exists';

describe('nodeIdExists (pattern)', () => {
    it('should return an empty array for non-string input', () => {
        const context = { document: { data: {} } };
        expect(nodeIdExists(null, null, asContext(context))).toEqual([]);
        expect(nodeIdExists(42, null, asContext(context))).toEqual([]);
    });

    it('should accept a node declared in prefixItems', () => {
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { properties: { 'unique-id': { const: 'webapp' } } }
                            ]
                        }
                    }
                }
            }
        };
        expect(nodeIdExists('webapp', null, asContext(context))).toEqual([]);
    });

    it('should accept a node declared only in an items.oneOf catalog', () => {
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { properties: { 'unique-id': { const: 'webapp' } } }
                            ],
                            items: {
                                oneOf: [
                                    { properties: { 'unique-id': { const: 'cache' } } },
                                    { properties: { 'unique-id': { const: 'queue' } } }
                                ]
                            }
                        }
                    }
                }
            }
        };
        // Referenced by a deployed-in relationship / decision choice — must not false-positive.
        expect(nodeIdExists('cache', null, asContext(context))).toEqual([]);
        expect(nodeIdExists('queue', null, asContext(context))).toEqual([]);
    });

    it('should accept a node declared only in an items.anyOf catalog', () => {
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            items: {
                                anyOf: [
                                    { properties: { 'unique-id': { const: 'cache' } } }
                                ]
                            }
                        }
                    }
                }
            }
        };
        expect(nodeIdExists('cache', null, asContext(context))).toEqual([]);
    });

    it('should report a node id that exists in neither prefixItems nor the items catalog', () => {
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { properties: { 'unique-id': { const: 'webapp' } } }
                            ],
                            items: {
                                oneOf: [
                                    { properties: { 'unique-id': { const: 'cache' } } }
                                ]
                            }
                        }
                    }
                }
            },
            path: ['/relationships/0/relationship-type/deployed-in/nodes/0']
        };
        const missingId = 'ghost';
        const result = nodeIdExists(missingId, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`'${missingId}' does not refer to the unique-id of an existing node.`);
    });
});
