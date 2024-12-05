import { SchemaDirectory } from '../schema-directory';
import { instantiateAllMetadata, instantiateMetadataObject } from './metadata';

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


describe('instantiateMetadataObject', () => {
    it('instantiate metadata object with simple properties', () => {
        const metadataDef = {
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
        expect(instantiateMetadataObject(metadataDef, mockSchemaDir, [], false, true))
            .toEqual(
                {
                    'string-prop': '{{ STRING_PROP }}',
                    'integer-prop': -1,
                    'boolean-prop': '{{ BOOLEAN_BOOLEAN_PROP }}',
                    'const-prop': 'constant'
                },
            );
    });
    
    it('instantiate metadata object with nested object properties', () => {
        const metadataDef = {
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
        expect(instantiateMetadataObject(metadataDef, mockSchemaDir, [], false, true))
            .toEqual(
                {
                    'property-name': {
                        'example': '{{ EXAMPLE }}'
                    }
                },
            );
    });

    it('instantiate metadata object with $ref', () => {
        const reference =  'http://calm.com/example-ref';
        const metadataDef = {
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


        expect(instantiateMetadataObject(metadataDef, mockSchemaDir, [], false, true))
            .toEqual(
                {
                    'property-name': {
                        'example': '{{ EXAMPLE }}'
                    }
                },
            );
        expect(spy).toHaveBeenCalledWith(reference);
    });
});

function getSamplePatternWithMetadata(...metadataDefs): object {
    return {
        properties: {
            metadata: {
                type: 'array',
                prefixItems: [
                    ...metadataDefs
                ]
            }
        }
    };
}


describe('instantiateAllMetadata', () => {
    it('instantiate simple metadata list with two objects', () => {
        const pattern = getSamplePatternWithMetadata({
            'type': 'object',
            'properties': {
                'property-name': {
                    'type': 'string'
                }
            }
        },
        {
            'type': 'object',
            'properties': {
                'property-name-2': {
                    'type': 'integer'
                }
            }
        }
        );
        expect(instantiateAllMetadata(pattern, mockSchemaDir, false, true))
            .toEqual(
                [
                    {
                        'property-name': '{{ PROPERTY_NAME }}'
                    },
                    {
                        'property-name-2': -1
                    }
                ]
            );
    });
});