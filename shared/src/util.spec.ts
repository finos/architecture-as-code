import { updateStringValuesRecursively } from './util';

describe('updateStringValuesRecursively', () => {
    it('Should update string values at top level', () => {
        const object = {
            'stringKey': 'abcd'
        };
        const mapped = updateStringValuesRecursively(object, (key, value) => value.toUpperCase());
        expect(mapped['stringKey']).toEqual('ABCD');
    });

    it('Should ignore non-string values at top level', () => {
        let wasCalled = false;
        const object = {
            'intKey': 123,
            'nullKey': null
        };
        updateStringValuesRecursively(object, (key, value) => { 
            wasCalled = true;
            return value;
        });
        expect(wasCalled).toBeFalsy();
    });
    
    it('Should update string values recursively, passing key', () => {
        const object = {
            'innerObj': {
                'modify': 'abcd'
            }, 
            'innerObj2': {
                'ignore': 'abcd'
            } 
        };
        const mapped = updateStringValuesRecursively(object, (key, value) => key === 'modify' 
            ? value.toUpperCase()
            : value);
        expect(mapped['innerObj']['modify']).toEqual('ABCD');
        expect(mapped['innerObj2']['ignore']).toEqual('abcd');
    });
});