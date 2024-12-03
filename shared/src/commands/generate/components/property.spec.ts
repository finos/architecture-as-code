/* eslint-disable  @typescript-eslint/no-explicit-any */

import { getConstValue, getEnumPlaceholder, getPropertyValue } from './property';

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

describe('getConstValue', () => {
    it('generates const value if const is provided', () => {
        expect(getConstValue({
            'const': 'Example value'
        }))
            .toBe('Example value');
    });

    it('generates const value with entire subtree if const is provided', () => {
        expect(getConstValue({
            'const': {
                'connects': {
                    'source': 'source',
                    'destination': 'destination'
                }
            }
        }))
            .toEqual({
                'connects': {
                    'source': 'source',
                    'destination': 'destination'
                }
            });
    });
});

describe('getPropertyValue', () => {
    it('generates string placeholder name from variable', () => {
        expect(getPropertyValue('key-name', {
            'type': 'string'
        }))
            .toBe('{{ KEY_NAME }}');
    });

    it('generates integer placeholder from variable', () => {
        expect(getPropertyValue('key-name', {
            'type': 'integer'
        }))
            .toBe(-1);
    });


    it('generates array with single string placeholder', () => {
        expect(getPropertyValue('key-name', {
            'type': 'array'
        }))
            .toEqual([
                '{{ KEY_NAME }}'
            ]);
    });

    it('generates a ref value placeholder', () => {
        expect(getPropertyValue('key-name', {
            '$ref': '#/ref'
        }))
            .toBe('{{ REF_KEY_NAME }}');
    });
    
    it('generates boolean placeholder from variable', () => {
        expect(getPropertyValue('key-name', {
            'type': 'boolean'
        }))
            .toBe('{{ BOOLEAN_KEY_NAME }}');
    });
});

describe('getEnumPlaceholder', () => {
    it('extracts ref name', () => {
        expect(getEnumPlaceholder('https://calm.com/core.json#def-name'))
            .toBe('{{ ENUM_DEF_NAME }}');
    });
});