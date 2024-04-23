/* eslint-disable  @typescript-eslint/no-explicit-any */

import { SchemaDirectory } from '../schema-directory';
import { instantiateRelationships } from './relationship';

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

jest.mock('../schema-directory')

let mockSchemaDir;

beforeEach(() => {
    mockSchemaDir = new SchemaDirectory("directory");
})

function getSamplePatternRelationship(properties: any): any {
    return {
        properties: {
            relationships: {
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

describe('instantiateRelationships', () => {

    it('return instantiated relationship with array property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                type: 'array'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir))
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

        expect(instantiateRelationships(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': '{{ PROPERTY_NAME }}'
                }
            ]);
    });

    it('return instantiated relationship with const property', () => {
        const pattern = getSamplePatternRelationship({
            'property-name': {
                const: 'value here'
            }
        });

        expect(instantiateRelationships(pattern, mockSchemaDir))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });
});