/* eslint-disable  @typescript-eslint/no-explicit-any */

import { instantiateNodeInterfaces, instantiateNodes } from "./node";

jest.mock('../../helper', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                debug: () => {}
            };
        }
    };
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
        expect(instantiateNodes(pattern))
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

        expect(instantiateNodes(pattern))
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

        expect(instantiateNodes(pattern))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
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

        expect(instantiateNodes(pattern))
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
        expect(instantiateNodeInterfaces(pattern))
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

        expect(instantiateNodeInterfaces(pattern))
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

        expect(instantiateNodeInterfaces(pattern))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });
});