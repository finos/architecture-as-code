import { describe, it, expect } from 'vitest';
import { registerGlobalTemplateHelpers } from './widget-helpers';

describe('Widget Helpers', () => {
    const helpers = registerGlobalTemplateHelpers();

    describe('eq helper', () => {
        it('returns true for equal values', () => {
            expect(helpers.eq(5, 5)).toBe(true);
            expect(helpers.eq('hello', 'hello')).toBe(true);
            expect(helpers.eq(null, null)).toBe(true);
        });

        it('returns false for unequal values', () => {
            expect(helpers.eq(5, 10)).toBe(false);
            expect(helpers.eq('hello', 'world')).toBe(false);
            expect(helpers.eq(null, undefined)).toBe(false);
        });
    });

    describe('ne helper', () => {
        it('returns false for equal values', () => {
            expect(helpers.ne(5, 5)).toBe(false);
            expect(helpers.ne('hello', 'hello')).toBe(false);
        });

        it('returns true for unequal values', () => {
            expect(helpers.ne(5, 10)).toBe(true);
            expect(helpers.ne('hello', 'world')).toBe(true);
        });
    });

    describe('currentTimestamp helper', () => {
        it('returns ISO timestamp string', () => {
            const timestamp = helpers.currentTimestamp();
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('currentDate helper', () => {
        it('returns date in YYYY-MM-DD format', () => {
            const date = helpers.currentDate();
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('lookup helper', () => {
        it('returns property value for string keys', () => {
            const obj = { name: 'John', age: 30 };
            expect(helpers.lookup(obj, 'name')).toBe('John');
            expect(helpers.lookup(obj, 'age')).toBe(30);
        });

        it('returns property value for numeric keys', () => {
            const arr = ['a', 'b', 'c'];
            expect(helpers.lookup(arr, 0)).toBe('a');
            expect(helpers.lookup(arr, 2)).toBe('c');
        });

        it('returns undefined for non-existent keys', () => {
            const obj = { name: 'John' };
            expect(helpers.lookup(obj, 'missing')).toBeUndefined();
        });

        it('returns undefined for invalid inputs', () => {
            expect(helpers.lookup(null, 'key')).toBeUndefined();
            expect(helpers.lookup({}, null)).toBeUndefined();
            expect(helpers.lookup({}, {})).toBeUndefined();
        });
    });

    describe('json helper', () => {
        it('stringifies objects with proper formatting', () => {
            const obj = { name: 'John', age: 30 };
            const result = helpers.json(obj);
            expect(result).toBe('{\n  "name": "John",\n  "age": 30\n}');
        });

        it('handles arrays', () => {
            const arr = [1, 2, 3];
            const result = helpers.json(arr);
            expect(result).toBe('[\n  1,\n  2,\n  3\n]');
        });

        it('handles primitive values', () => {
            expect(helpers.json('hello')).toBe('"hello"');
            expect(helpers.json(42)).toBe('42');
            expect(helpers.json(true)).toBe('true');
        });
    });

    describe('instanceOf helper', () => {
        it('returns true for matching constructor names', () => {
            const obj = new Date();
            expect(helpers.instanceOf(obj, 'Date')).toBe(true);
        });

        it('returns false for non-matching constructor names', () => {
            const obj = new Date();
            expect(helpers.instanceOf(obj, 'Array')).toBe(false);
        });

        it('returns false for invalid inputs', () => {
            expect(helpers.instanceOf(null, 'Date')).toBe(false);
            expect(helpers.instanceOf({}, null)).toBe(false);
            expect(helpers.instanceOf('string', 'String')).toBe(false);
        });
    });

    describe('kebabToTitleCase helper', () => {
        it('converts kebab-case to Title Case', () => {
            expect(helpers.kebabToTitleCase('hello-world')).toBe('Hello World');
            expect(helpers.kebabToTitleCase('api-gateway-service')).toBe('Api Gateway Service');
            expect(helpers.kebabToTitleCase('single')).toBe('Single');
        });

        it('handles empty and invalid inputs', () => {
            expect(helpers.kebabToTitleCase('')).toBe('');
            expect(helpers.kebabToTitleCase(null)).toBe('');
            expect(helpers.kebabToTitleCase(undefined)).toBe('');
            expect(helpers.kebabToTitleCase(123)).toBe('');
        });

        it('handles already capitalized words', () => {
            expect(helpers.kebabToTitleCase('API-Gateway')).toBe('API Gateway');
        });
    });

    describe('kebabCase helper', () => {
        it('converts strings to kebab-case', () => {
            expect(helpers.kebabCase('Hello World')).toBe('hello-world');
            expect(helpers.kebabCase('API Gateway Service')).toBe('api-gateway-service');
            expect(helpers.kebabCase('camelCaseString')).toBe('camelcasestring');
        });

        it('handles special characters', () => {
            expect(helpers.kebabCase('Hello & World!')).toBe('hello-world');
            expect(helpers.kebabCase('Test@123#456')).toBe('test-123-456');
        });

        it('handles empty and invalid inputs', () => {
            expect(helpers.kebabCase('')).toBe('');
            expect(helpers.kebabCase(null)).toBe('');
            expect(helpers.kebabCase(undefined)).toBe('');
            expect(helpers.kebabCase(123)).toBe('');
        });

        it('removes leading and trailing dashes', () => {
            expect(helpers.kebabCase('  hello world  ')).toBe('hello-world');
            expect(helpers.kebabCase('---test---')).toBe('test');
        });
    });

    describe('isObject helper', () => {
        it('returns true for plain objects', () => {
            expect(helpers.isObject({})).toBe(true);
            expect(helpers.isObject({ key: 'value' })).toBe(true);
        });

        it('returns false for arrays', () => {
            expect(helpers.isObject([])).toBe(false);
            expect(helpers.isObject([1, 2, 3])).toBe(false);
        });

        it('returns false for null and undefined', () => {
            expect(helpers.isObject(null)).toBe(false);
            expect(helpers.isObject(undefined)).toBe(false);
        });

        it('returns false for primitive values', () => {
            expect(helpers.isObject('string')).toBe(false);
            expect(helpers.isObject(123)).toBe(false);
            expect(helpers.isObject(true)).toBe(false);
        });
    });

    describe('isArray helper', () => {
        it('returns true for arrays', () => {
            expect(helpers.isArray([])).toBe(true);
            expect(helpers.isArray([1, 2, 3])).toBe(true);
        });

        it('returns false for non-arrays', () => {
            expect(helpers.isArray({})).toBe(false);
            expect(helpers.isArray('string')).toBe(false);
            expect(helpers.isArray(null)).toBe(false);
        });
    });

    describe('notEmpty helper', () => {
        it('returns true for non-empty arrays', () => {
            expect(helpers.notEmpty([1, 2, 3])).toBe(true);
            expect(helpers.notEmpty(['a'])).toBe(true);
        });

        it('returns false for empty arrays', () => {
            expect(helpers.notEmpty([])).toBe(false);
        });

        it('returns true for non-empty objects', () => {
            expect(helpers.notEmpty({ key: 'value' })).toBe(true);
        });

        it('returns false for empty objects', () => {
            expect(helpers.notEmpty({})).toBe(false);
        });

        it('handles Maps and Sets', () => {
            expect(helpers.notEmpty(new Map([['key', 'value']]))).toBe(true);
            expect(helpers.notEmpty(new Map())).toBe(false);
            expect(helpers.notEmpty(new Set([1, 2]))).toBe(true);
            expect(helpers.notEmpty(new Set())).toBe(false);
        });

        it('returns true for non-empty strings', () => {
            expect(helpers.notEmpty('hello')).toBe(true);
        });

        it('returns false for empty or whitespace-only strings', () => {
            expect(helpers.notEmpty('')).toBe(false);
            expect(helpers.notEmpty('   ')).toBe(false);
            expect(helpers.notEmpty(' ')).toBe(false); // whitespace-only strings are treated as empty
        });

        it('returns false for null and undefined', () => {
            expect(helpers.notEmpty(null)).toBe(false);
            expect(helpers.notEmpty(undefined)).toBe(false);
        });

        it('returns boolean value for other types', () => {
            expect(helpers.notEmpty(0)).toBe(false);
            expect(helpers.notEmpty(1)).toBe(true);
            expect(helpers.notEmpty(false)).toBe(false);
            expect(helpers.notEmpty(true)).toBe(true);
        });
    });

    describe('or helper', () => {
        it('returns true if any argument is truthy', () => {
            expect(helpers.or(false, true, false)).toBe(true);
            expect(helpers.or(0, '', 'hello')).toBe(true);
            expect(helpers.or(null, undefined, 42)).toBe(true);
        });

        it('returns false if all arguments are falsy', () => {
            expect(helpers.or(false, false, false)).toBe(false);
            expect(helpers.or(0, '', null)).toBe(false);
            expect(helpers.or(undefined, false)).toBe(false);
        });

        it('handles handlebars options parameter', () => {
            const options = { fn: () => 'template' };
            expect(helpers.or(false, false, options)).toBe(false);
            expect(helpers.or(true, false, options)).toBe(true);
        });

        it('handles empty arguments', () => {
            expect(helpers.or()).toBe(false);
        });
    });

    describe('eachInMap helper', () => {
        it('iterates over object properties with primitive values', () => {
            const map = { a: 'value1', b: 'value2' };
            const mockOptions = {
                fn: (context: unknown) => {
                    const ctx = context as Record<string, unknown>;
                    return `${ctx.key}:${ctx.key === 'a' ? 'value1' : 'value2'};`;
                }
            };

            const result = helpers.eachInMap(map, mockOptions);
            expect(result).toContain('a:value1;');
            expect(result).toContain('b:value2;');
        });

        it('passes key with object values', () => {
            const map = { user1: { name: 'John' }, user2: { name: 'Jane' } };
            const mockOptions = {
                fn: (context: unknown) => {
                    const ctx = context as Record<string, unknown>;
                    return `${ctx.key}:${ctx.name};`;
                }
            };

            const result = helpers.eachInMap(map, mockOptions);
            expect(result).toContain('user1:John;');
            expect(result).toContain('user2:Jane;');
        });

        it('handles non-object values', () => {
            const map = { count: 5, flag: true };
            const mockOptions = {
                fn: (context: unknown) => {
                    const ctx = context as Record<string, unknown>;
                    return `${ctx.key};`;
                }
            };

            const result = helpers.eachInMap(map, mockOptions);
            expect(result).toContain('count;');
            expect(result).toContain('flag;');
        });

        it('returns empty string for invalid inputs', () => {
            expect(helpers.eachInMap(null, {})).toBe('');
            expect(helpers.eachInMap({}, null)).toBe('');
            expect(helpers.eachInMap({}, { notAFunction: true })).toBe('');
        });
    });
});
