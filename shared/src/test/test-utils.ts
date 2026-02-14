// Defines all the schema versions to test against.
export const TEST_ALL_SCHEMA = [['1.0'], ['1.1'], ['1.2']];
export const TEST_1_1_SCHEMA_AND_ABOVE = TEST_ALL_SCHEMA.filter(s => s[0] != '1.0');
export const TEST_1_2_SCHEMA_AND_ABOVE = TEST_1_1_SCHEMA_AND_ABOVE.filter(s => s[0] != '1.1');

/**
 * Take an architecture object and a desired schema release version, e.g. '1.3',
 * and return a new object with all CALM schema references updated to that version.
 * It performs a deep clone of the input object, ensuring that all nested $ref values
 * that match the CALM schema reference pattern are updated accordingly.
 * The function also updates the top-level $schema property to point to the new version.
 */
export function setCalmSchema(arch: any, schemaVersion: string): any {
    /**
     * Deep clone and update all $ref values that are CALM schema references
     */
    function updateCalmRefs(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => updateCalmRefs(item));
        }

        if (typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    if (key === '$ref' && typeof obj[key] === 'string') {
                        // Update CALM schema references
                        const refValue = obj[key];
                        // Match patterns like https://calm.finos.org/release/<version>/meta/ or https://calm.finos.org/draft/<version>/meta/
                        const calmRefPattern = /^https:\/\/calm\.finos\.org\/(release|draft)\/[^/]+\/meta\//;
                        if (calmRefPattern.test(refValue)) {
                            // Replace version in reference with provided schemaVersion
                            result[key] = refValue.replace(
                                /^(https:\/\/calm\.finos\.org\/release\/)([^/]+)(\/meta\/)/,
                                `$1${schemaVersion}$3`
                            );
                        } else {
                            result[key] = refValue;
                        }
                    } else {
                        result[key] = updateCalmRefs(obj[key]);
                    }
                }
            }
            return result;
        }

        return obj;
    }

    const updated = updateCalmRefs(arch);
    return {
        ...updated,
        '$schema': `https://calm.finos.org/release/${schemaVersion}/meta/calm.json`
    };
}