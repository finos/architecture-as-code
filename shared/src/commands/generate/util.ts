import _ from 'lodash';
import { Logger } from 'winston';
import pointer from 'json-pointer';

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

export function appendPath<T>(path: T[], element: T) : T[] {
    return [...path, element];
}

export function renderPath(path: string[]): string {
    return pointer.compile(path);
}

/**
 * Apply an update to the string keys of an object, recursively.   
 * The provided function should map a key and value to the new value. To leave a value unmodified, just return the original value.
 * @param obj The object to modify.
 * @param mappingFunction The function to apply. Takes the key and the value, and returns the new value to set it to. 
 * @returns 
 */
export function updateStringValuesRecursively(def: object, mappingFunction: (key: string, value: string) => string): object {
    const update = (obj) => {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                update(obj[i]);
            }
        }
        else if (typeof obj == 'object') {
            for (const key in obj) {
                const value = obj[key];
                if (typeof value === 'string') {
                    obj[key] = mappingFunction(key, value);
                }
                else {
                    update(obj[key]);
                }
            }
        }
    };

    const clone = _.cloneDeep(def);
    update(clone);
    return clone;
}