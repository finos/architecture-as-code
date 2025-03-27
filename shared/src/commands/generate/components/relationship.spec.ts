/* eslint-disable  @typescript-eslint/no-explicit-any */

import { SchemaDirectory } from '../../../schema-directory';
import { instantiateRelationships } from './relationship';

vi.mock('../../../logger', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                debug: () => {}
            };
        }
    };
});

vi.mock('../../../schema-directory');

let mockSchemaDir;

beforeEach(() => {
    mockSchemaDir = new SchemaDirectory();
});

function getSamplePatternRelationship(properties: any, required: string[] = []): any {
    return {
        properties: {
            relationships: {
                type: 'array',
                prefixItems: [
                    {
                        properties: properties,
                        required: required
                    }
                ]
            }
        }
    };
}

describe('instantiateRelationships', () => {

    it('return instantiated relationship with array property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                type: 'array'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir, false, true))
            .toEqual(
                [{
                    'property-name': [
                        '{{ PROPERTY_NAME }}'
                    ]
                }]
            );
    });

    it('return instantiated relationship with string property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                type: 'string'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir, false, true))
            .toEqual([
                {
                    'property-name': '{{ PROPERTY_NAME }}'
                }
            ]);
    });
    
    it('return instantiated relationship with boolean property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                type: 'boolean'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir, false, true))
            .toEqual([
                {
                    'property-name': '{{ BOOLEAN_PROPERTY_NAME }}'
                }
            ]);
    });

    it('return instantiated relationship with const property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                const: 'value here'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir, false, true))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });

    it('only instantiate required properties when instantiateAll set to false', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                const: 'value here'
            },
            'ignored-prop': {
                const: 'value'
            }
        }, ['property-name']);

        expect(instantiateRelationships(pattern, mockSchemaDir, false, false))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });

    it('call schema directory to resolve $ref relationships`', () => {
        const reference = 'https://calm.com/core.json#/relationship';
        const pattern = {
            properties: {
                relationships: {
                    type: 'array',
                    prefixItems: [
                        {
                            '$ref': reference
                        }
                    ]
                }
            }
        };

        const spy = vi.spyOn(mockSchemaDir, 'getDefinition');
        spy.mockReturnValue({
            properties: {
                'property-name': {
                    const: 'value here'
                }
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir, false, true))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
        expect(spy).toHaveBeenCalledWith(reference);
    });
});