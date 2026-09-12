import { RulesetFunctionContext } from '@stoplight/spectral-core';
import { isDefinedInOneOfOrAnyOf } from './is-defined-in-oneof-or-anyof';

const asContext = (data: object) => ({ document: { data }, path: ['relationships', 0] } as unknown as RulesetFunctionContext);

const declaration = (id: string) => ({ properties: { 'unique-id': { const: id } } });

const pattern = (calmType: 'nodes' | 'relationships', entries: object[]) => ({
    properties: { [calmType]: { prefixItems: entries } }
});

const messagesFor = (data: object, input: unknown, calmType: 'nodes' | 'relationships' = 'nodes') =>
    isDefinedInOneOfOrAnyOf(input, { calmType }, asContext(data)).map(result => result.message);

describe('isDefinedInOneOfOrAnyOf', () => {
    it('reports an id declared only as a fixed entry', () => {
        const data = pattern('nodes', [declaration('redis')]);
        expect(messagesFor(data, 'redis')).toEqual([
            '\'redis\' is part of a pattern option and must be defined in a oneOf or anyOf block.'
        ]);
    });

    it('reports a relationship id declared only as a fixed entry', () => {
        const data = pattern('relationships', [declaration('cache-link')]);
        expect(messagesFor(data, 'cache-link', 'relationships')).toHaveLength(1);
    });

    it('accepts an id declared inside oneOf', () => {
        const data = pattern('nodes', [{ oneOf: [declaration('redis'), declaration('memcached')] }]);
        expect(messagesFor(data, 'redis')).toEqual([]);
    });

    it('accepts an id declared inside anyOf', () => {
        const data = pattern('nodes', [{ anyOf: [declaration('redis')] }]);
        expect(messagesFor(data, 'redis')).toEqual([]);
    });

    it('accepts an id the pattern does not declare', () => {
        const data = pattern('nodes', [declaration('webapp')]);
        expect(messagesFor(data, 'redis')).toEqual([]);
    });

    it('reports at the path of the reference', () => {
        const data = pattern('nodes', [declaration('redis')]);
        const results = isDefinedInOneOfOrAnyOf('redis', { calmType: 'nodes' }, asContext(data));
        expect(results[0].path).toEqual(['relationships', 0]);
    });

    it.each([['', 'empty string'], [null, 'null'], [undefined, 'undefined'], [42, 'a number']])(
        'ignores %s input (%s)', input => {
            const data = pattern('nodes', [declaration('redis')]);
            expect(messagesFor(data, input)).toEqual([]);
        });
});
