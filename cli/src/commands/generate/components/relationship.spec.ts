/* eslint-disable  @typescript-eslint/no-explicit-any */

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

        expect(instantiateRelationships(pattern))
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

        expect(instantiateRelationships(pattern))
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

        expect(instantiateRelationships(pattern))
            .toEqual([
                {
                    'property-name': 'value here'
                }
            ]);
    });
});