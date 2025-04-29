// Required because sometimes the set API of Typescript is not supported.

/**
 * @param set1 
 * @param set2 
 * @returns union of set1 and set2.
 */
export function union<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1, ...set2]);
}

/**
 * 
 * @param set1 
 * @param set2 
 * @returns intersection between set1 and set2.
 */
export function intersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1].filter((item) => set2.has(item)));
}

/**
 * 
 * @param set1 
 * @param set2 
 * @returns set1 - set2 i.e. elements in set1 that are not in set2.
 */
export function difference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1].filter((item) => !set2.has(item)));
}
