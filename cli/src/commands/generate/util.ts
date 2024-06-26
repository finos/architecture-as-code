import _ from 'lodash';
import { Logger } from 'winston';

/**
 * Recursively merge two schemas into a new object, without modifying either.
 * In the event of a clash - i.e. two properties with the same name - the property from the second parameter will take precedence.
 * @param s1 The first schema to merge
 * @param s2 The second schema to merge. Takes precedence in the event of clashes.
 * @returns A new merged schema
 */
export function mergeSchemas(s1: object, s2: object) {
    const s1Required = (s1 ?? {}) ['required'] ?? [];
    const s2Required = (s2 ?? {}) ['required'] ?? [];
    const newRequired = _.uniq([...s1Required, ...s2Required]);
    const newSchema = _.merge({}, s1, s2);

    newSchema['required'] = newRequired;
    return newSchema;
}

export function logRequiredMessage(logger: Logger, required: string[], instantiateAll: boolean) {
    if (instantiateAll) {
        logger.debug('--instantiateAll was set, ignoring required list and instantiating all properties.');
    } else {
        logger.debug('Required properties: ' + required);
    }
}