/* eslint-disable  @typescript-eslint/no-explicit-any */

import { SchemaDirectory } from '../schema-directory';
import { instantiateNodeInterfaces, instantiateNodes } from './node';

jest.mock('../../helper', () => {
    return {
        initLogger: () => {
            return {
                info: () => { },
                debug: () => { }
            };
        }
    };
});

jest.mock('../schema-directory');

let mockSchemaDir;

beforeEach(() => {
    mockSchemaDir = new SchemaDirectory('directory');
});

function getSamplePatternNode(properties: any): any {
    return {
        properties: {
            nodes: {
                type: 'array',
                prefixItems: [
                    {
                        properties: properties
                    }
                ]
            }
        }
    };
}


describe('instantiateNodes', () => {
    it('return instantiated node with array property', () => {
        const pattern = getSamplePatternNode({
            'property-name': {
                type: 'array'
            }
        });
        expect(instantiateNodes(pattern, mockSchemaDir))
            .toEqual(
                [{
                    'property-name': [
                        '{{ PROPERTY_NAME }}'
                    ]
                }]
            );
    });

    it('return instantiated node with string property', () => {
        const pattern = getSamplePatternNode({
            'property-name': {
                type: 'string'
            }
        });

        expect(instantiateNodes(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': '{{ PROPERTY_NAME }}'
                }
            ]);
    });

    it('return instantiated node with const property', () => {
        const pattern = getSamplePatternNode({
            'property-name': {
                const: 'value here'
            }
        });

        expect(instantiateNodes(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });

    it('call schema directory to resolve $ref nodes`', () => {
        const reference = 'https://calm.com/core.json#/node';
        const pattern = {
            properties: {
                nodes: {
                    type: 'array',
                    prefixItems: [
                        {
                            '$ref': reference
                        }
                    ]
                }
            }
        };

        const spy = jest.spyOn(mockSchemaDir, 'getDefinition');
        spy.mockReturnValue({
            properties: {
                'property-name': {
                    const: 'value here'
                }
            }
        });

        expect(instantiateNodes(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
        expect(spy).toHaveBeenCalledWith(reference);
    });

    it('return instantiated node with interface', () => {
        const pattern = {
            properties: {
                nodes: {
                    type: 'array',
                    prefixItems: [
                        {
                            properties: {
                                'unique-id': {
                                    'const': 'unique-id'
                                },
                                // interfaces should be inserted
                                'interfaces': {
                                    'prefixItems': [
                                        {
                                            properties: {
                                                // should insert placeholder {{ INTERFACE_PROPERTY }}
                                                'interface-property': {
                                                    'type': 'string'
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }

            }

        };

        const expected = [
            {
                'unique-id': 'unique-id',
                'interfaces': [
                    {
                        'interface-property': '{{ INTERFACE_PROPERTY }}'
                    }
                ]
            }
        ];

        expect(instantiateNodes(pattern, mockSchemaDir))
            .toEqual(expected);

    });
});


function getSampleNodeInterfaces(properties: any): any {
    return {
        prefixItems: [
            {
                properties: properties
            }
        ]
    };
}


describe('instantiateNodeInterfaces', () => {

    it('return instantiated node with array property', () => {
        const pattern = getSampleNodeInterfaces({
            'property-name': {
                type: 'array'
            }
        });
        expect(instantiateNodeInterfaces(pattern, mockSchemaDir))
            .toEqual(
                [{
                    'property-name': [
                        '{{ PROPERTY_NAME }}'
                    ]
                }]
            );
    });

    it('return instantiated node with string property', () => {
        const pattern = getSampleNodeInterfaces({
            'property-name': {
                type: 'string'
            }
        });

        expect(instantiateNodeInterfaces(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': '{{ PROPERTY_NAME }}'
                }
            ]);
    });

    it('return instantiated node with const property', () => {
        const pattern = getSampleNodeInterfaces({
            'property-name': {
                const: 'value here'
            }
        });

        expect(instantiateNodeInterfaces(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });

    it('call schema directory to resolve $ref interfaces`', () => {
        const reference = 'https://calm.com/core.json#/interface';

        const pattern = {
            prefixItems: [
                {
                    '$ref': reference
                }
            ]
        };

        const spy = jest.spyOn(mockSchemaDir, 'getDefinition');
        spy.mockReturnValue({
            properties: {
                'property-name': {
                    const: 'value here'
                }
            }
        });

        expect(instantiateNodeInterfaces(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
        expect(spy).toHaveBeenCalledWith(reference);
    });
});