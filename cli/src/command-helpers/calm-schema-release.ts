import { version as calmSchemaVersion } from '@finos/calm-schema/package.json';

/** The `<major>.<minor>` of the bundled `@finos/calm-schema`, so a schema bump moves generated documents too. */
export const CALM_SCHEMA_RELEASE = calmSchemaRelease(calmSchemaVersion);

export const CALM_META_SCHEMA_BASE_URL = `https://calm.finos.org/release/${CALM_SCHEMA_RELEASE}/meta`;

export function calmSchemaRelease(version: string): string {
    const match = /^(\d+)\.(\d+)\.\d+$/.exec(version);
    if (!match) {
        throw new Error(`@finos/calm-schema version '${version}' is not <major>.<minor>.<patch>.`);
    }
    return `${match[1]}.${match[2]}`;
}
