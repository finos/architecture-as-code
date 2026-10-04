import { createRequire } from 'module';
import path from 'path';
import type { Logger } from '../logger';

export function createMockLogger(): Logger {
    return {
        log: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

const ROOT_DIR = path.join(__dirname, '../../..');
// Root devDependencies always install into the repository root node_modules.
const ROOT_NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

// The release of each calm-schema-<major.minor> alias in the root package.json, oldest first, so
// the alias that a schema update adds also joins the test matrix. Read with require, not fs, so
// that specs which mock fs can still import this module.
const ALIASED_RELEASES: string[] = Object.entries<string>(
    createRequire(__filename)(path.join(ROOT_DIR, 'package.json')).devDependencies ?? {},
)
    .filter(([, spec]) => spec.startsWith('npm:@finos/calm-schema@'))
    .map(([name]) => /^calm-schema-(\d+\.\d+)$/.exec(name)?.[1])
    .filter((release): release is string => release !== undefined)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Defines all the schema versions to test against.
export const TEST_ALL_SCHEMA = ALIASED_RELEASES.map(release => [release]);
export const TEST_1_1_SCHEMA_AND_ABOVE = TEST_ALL_SCHEMA.filter(s => s[0] != '1.0');
export const TEST_1_2_SCHEMA_AND_ABOVE = TEST_1_1_SCHEMA_AND_ABOVE.filter(s => s[0] != '1.1');

/**
 * The schema folder of the latest @finos/calm-schema release or, when a release is given
 * (e.g. '1.1'), of its calm-schema-<release> alias.
 */
export function calmSchemaDir(release?: string): string {
    return path.join(ROOT_NODE_MODULES, release ? `calm-schema-${release}` : '@finos/calm-schema', 'schema');
}

/**
 * Take an architecture object and a desired schema release version, e.g. '1.3',
 * and return a new object with all CALM schema references updated to that version.
 * It performs a deep clone of the input object, ensuring that all nested $ref values
 * that match the CALM schema reference pattern are updated accordingly.
 * The function also updates the top-level $schema property to point to the new version.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setCalmSchema(arch: any, schemaVersion: string): any {
    /**
     * Deep clone and update all $ref values that are CALM schema references
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function updateCalmRefs(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => updateCalmRefs(item));
        }

        if (typeof obj === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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