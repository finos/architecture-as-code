/* eslint-disable  @typescript-eslint/no-explicit-any */

import { arrayBuffer } from 'stream/consumers';
import { SchemaDirectory } from '../schema-directory';
import { instantiateGenericObject } from './instantiate';

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
    mockSchemaDir = new SchemaDirectory();
});



describe('instantiateGenericObject', () => {
    it('instantiate object with simple properties', () => {
        const objectDef = {
            'type': 'object',
            'properties': {
                'string-prop': {
                    'type': 'string'
                },
                'integer-prop': {
                    'type': 'integer'
                },
                'boolean-prop': {
                    'type': 'boolean'
                },
                'const-prop': {
                    'const': 'constant'
                }
            }
        };
        expect(instantiateGenericObject(objectDef, mockSchemaDir, 'generic', [], false, true))
            .toEqual(
                {
                    'string-prop': '{{ STRING_PROP }}',
                    'integer-prop': -1,
                    'boolean-prop': '{{ BOOLEAN_BOOLEAN_PROP }}',
                    'const-prop': 'constant'
                },
            );
    });
    
    it('instantiate object with nested object properties', () => {
        const objectDef = {
            'type': 'object',
            'properties': {
                'property-name': {
                    'type': 'object',
                    'properties': {
                        'example': {
                            'type': 'string'
                        }
                    }
                }
            }
        };
        expect(instantiateGenericObject(objectDef, mockSchemaDir, 'generic', [], false, true))
            .toEqual(
                {
                    'property-name': {
                        'example': '{{ EXAMPLE }}'
                    }
                },
            );
    });

    it('instantiate object with $ref', () => {
        const reference =  'http://calm.com/example-ref';
        const objectDef = {
            '$ref': reference
        };

        const returnedDef = {
            'type': 'object',
            'properties': {
                'property-name': {
                    'type': 'object',
                    'properties': {
                        'example': {
                            'type': 'string'
                        }
                    }
                }
            }
        };

        const spy = jest.spyOn(mockSchemaDir, 'getDefinition');
        spy.mockReturnValue(returnedDef);


        expect(instantiateGenericObject(objectDef, mockSchemaDir, 'generic', [], false, true))
            .toEqual(
                {
                    'property-name': {
                        'example': '{{ EXAMPLE }}'
                    }
                },
            );
        expect(spy).toHaveBeenCalledWith(reference);
    });

    it('instantiate object with simple array property to placeholder', () => {
        const objectDef = {
            'type': 'object',
            'properties': {
                'property-name': {
                    'type': 'array',
                    'items': 'string'
                }
            }
        };
        expect(instantiateGenericObject(objectDef, mockSchemaDir, 'generic', [], false, true))
            .toEqual(
                {
                    'property-name': [ 
                        '{{ PROPERTY_NAME }}' 
                    ]
                },
            );
    });
    
    it('instantiate object with complex/prefixItems array property', () => {
        const objectDef = {
            'type': 'object',
            'properties': {
                'property-name': {
                    'type': 'array',
                    'prefixItems': [
                        {
                            'type': 'object',
                            'properties': {
                                'property': {
                                    'const': 'value'
                                }
                            }
                        }
                    ]
                }
            }
        };
        expect(instantiateGenericObject(objectDef, mockSchemaDir, 'generic', [], false, true))
            .toEqual(
                {
                    'property-name': [ 
                        {
                            'property': 'value'
                        }
                    ]
                },
            );
    });
});

function getSampleArrayContents(properties: any, required: string[] = []): any {
    return {
        type: 'array',
        prefixItems: [
            {
                properties: properties,
                required: required
            }
        ]
    };
}


// describe('instantiateGenericObject', () => {

//     it('return instantiated node with array property', () => {
//        const pattern = getSampleNodeInterfaces({
//             'property-name': {
//                 type: 'array'
//             }
//         });
//         expect(instantiateNodeInterfaces(pattern, mockSchemaDir, false, true))
//             .toEqual(
//                 [{
//                     'property-name': [
//                         '{{ PROPERTY_NAME }}'
//                     ]
//                 }]
//             );
//     });

//     it('return instantiated node with string property', () => {
//         const pattern = getSampleNodeInterfaces({
//             'property-name': {
//                 type: 'string'
//             }
//         });

//         expect(instantiateNodeInterfaces(pattern, mockSchemaDir, false, true))
//             .toEqual([
//                 {
//                     'property-name': '{{ PROPERTY_NAME }}'
//                 }
//             ]);
//     });

//     it('return instantiated node with const property', () => {
//         const pattern = getSampleNodeInterfaces({
//             'property-name': {
//                 const: 'value here'
//             }
//         });

//         expect(instantiateNodeInterfaces(pattern, mockSchemaDir, false, true))
//             .toEqual([
//                 {
//                     'property-name': 'value here'
//                 }
//             ]);
//     });
    
//     it('only instantiate required properties when instantiateAll set to false', () => {
//         const pattern = getSampleNodeInterfaces({
//             'property-name': {
//                 const: 'value here'
//             },
//             'ignored-prop': {
//                 const: 'value here'
//             }
//         }, ['property-name']);

//         expect(instantiateNodeInterfaces(pattern, mockSchemaDir, false, false))
//             .toEqual([
//                 {
//                     'property-name': 'value here'
//                 }
//             ]);
//     });

//     it('call schema directory to resolve $ref interfaces`', () => {
//         const reference = 'https://calm.com/core.json#/interface';

//         const pattern = {
//             prefixItems: [
//                 {
//                     '$ref': reference
//                 }
//             ]
//         };

//         const spy = jest.spyOn(mockSchemaDir, 'getDefinition');
//         spy.mockReturnValue({
//             properties: {
//                 'property-name': {
//                     const: 'value here'
//                 }
//             }
//         });

//         expect(instantiateNodeInterfaces(pattern, mockSchemaDir, false, true))
//             .toEqual([
//                 {
//                     'property-name': 'value here'
//                 }
//             ]);
//         expect(spy).toHaveBeenCalledWith(reference);
//     });
// });