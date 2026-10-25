// The CALM meta-schemas the lab validates against, keyed by $id for the in-memory document loader.

// Every release that the root package.json pins, as the CLI bundles them: the @finos/calm-schema
// latest release and each calm-schema-<major.minor> alias. `exhaustive` lets the glob search
// node_modules.
const releases = import.meta.glob<{ $id: string }>(
    '../../node_modules/{@finos/calm-schema,calm-schema-*}/schema/*.json',
    { eager: true, import: 'default', exhaustive: true },
);

export function calmRelease(id: unknown): string {
    const release = typeof id === 'string' ? /^https:\/\/calm\.finos\.org\/release\/(\d+\.\d+)\/meta\/calm\.json$/.exec(id)?.[1] : undefined;
    if (!release) {
        throw new Error(`'${String(id)}' is not a CALM release calm.json $id.`);
    }
    return release;
}

/**
 * The `<major>.<minor>` of the pinned `@finos/calm-schema`, so a schema bump moves the lessons too.
 * Read from the bundled calm.json `$id`, not the package version: `src/` imports no manifests (see
 * `vite.config.ts`), and the `$id` makes `${CALM_META_SCHEMA_BASE_URL}/calm.json` a key in `SCHEMAS`.
 */
export const CALM_SCHEMA_RELEASE = calmRelease(releases['../../node_modules/@finos/calm-schema/schema/calm.json']?.$id);

export const CALM_META_SCHEMA_BASE_URL = `https://calm.finos.org/release/${CALM_SCHEMA_RELEASE}/meta`;

export const SCHEMAS: Record<string, object> = Object.fromEntries(Object.values(releases).map((schema) => [schema.$id, schema]));
