import { readFileSync } from 'fs';
import path from 'path';
import { asContext } from '../spectral-test-helpers';
import nodeIdExists from './node-id-exists';

const optionsPrototypePatternPath = path.join(
    __dirname,
    '../../../../../calm/release/1.0-rc2/prototype/multiple-choices/options-prototype.pattern.json'
);

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

    it('accepts a node declared as a prefixItems oneOf/anyOf slot alternative', () => {
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { oneOf: [{ properties: { 'unique-id': { const: 'sql-store' } } }] },
                                { anyOf: [{ properties: { 'unique-id': { const: 'nosql-store' } } }] }
                            ]
                        }
                    }
                }
            }
        };
        expect(nodeIdExists('sql-store', null, asContext(context))).toEqual([]);
        expect(nodeIdExists('nosql-store', null, asContext(context))).toEqual([]);
    });

    it('accepts every node in the shipped multiple-choices options prototype pattern', () => {
        // Regression test for the same fixture ids-are-unique is pinned against: nodes
        // declared as prefixItems oneOf/anyOf slot alternatives must resolve correctly
        // through the migrated candidate enumeration.
        const pattern = JSON.parse(readFileSync(optionsPrototypePatternPath, 'utf-8'));
        const context = { document: { data: pattern } };

        for (const nodeId of ['application-a', 'application-b', 'node-1', 'node-2', 'application-c', 'database']) {
            expect(nodeIdExists(nodeId, null, asContext(context))).toEqual([]);
        }
    });
});
