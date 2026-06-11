import _ from 'lodash';
import pointer from 'json-pointer';

/**
 * Recursively merge two schemas into a new object, without modifying either.
 * In the event of a clash - i.e. two properties with the same name - the property from the second parameter will take precedence.
 * @param s1 The first schema to merge
 * @param s2 The second schema to merge. Takes precedence in the event of clashes.
 * @returns A new merged schema
 */
export function mergeSchemas(s1: object, s2: object) {
    const s1Required = (s1 as { required?: string[] })?.required ?? [];
    const s2Required = (s2 as { required?: string[] })?.required ?? [];
    const newRequired = _.uniq([...s1Required, ...s2Required]);
    const newSchema = _.merge({}, s1, s2) as Record<string, unknown>;

    newSchema['required'] = newRequired;
    return newSchema;
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
    const update = (obj: unknown) => {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                update(obj[i]);
            }
        }
        else if (obj && typeof obj == 'object') {
            const record = obj as Record<string, unknown>;
            for (const key in record) {
                const value = record[key];
                if (typeof value === 'string') {
                    record[key] = mappingFunction(key, value);
                }
                else {
                    update(record[key]);
                }
            }
        }
    };

    const clone = _.cloneDeep(def);
    update(clone);
    return clone;
}