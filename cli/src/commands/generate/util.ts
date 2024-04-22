export function mergeSchemas(s1: object, s2: object) {
    return {
        ...s1, ...s2
    }
}