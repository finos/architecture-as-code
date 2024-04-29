import _ from 'lodash';

/**
 * Recursively merge two schemas into a new object, without modifying either.
 * In the event of a clash - i.e. two properties with the same name - the property from the second parameter will take precedence.
 * @param s1 The first schema to merge
 * @param s2 The second schema to merge. Takes precedence in the event of clashes.
 * @returns A new merged schema
 */
export function mergeSchemas(s1: object, s2: object) {
    return _.merge({}, s1, s2);
}