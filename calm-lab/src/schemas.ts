// The CALM meta-schemas the lab validates against, keyed by $id for the in-memory document loader.
// draft/2025-03 set: documents that declare the draft $schema (e.g. the TraderX sample) validate
// against their declared schema rather than falling back to a release.
import draftCalm from '../../calm/draft/2025-03/meta/calm.json';
import draftCore from '../../calm/draft/2025-03/meta/core.json';
import draftInterface from '../../calm/draft/2025-03/meta/interface.json';
import draftControl from '../../calm/draft/2025-03/meta/control.json';
import draftControlRequirement from '../../calm/draft/2025-03/meta/control-requirement.json';
import draftEvidence from '../../calm/draft/2025-03/meta/evidence.json';
import draftFlow from '../../calm/draft/2025-03/meta/flow.json';
import draftUnits from '../../calm/draft/2025-03/meta/units.json';

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

/** The `<major>.<minor>` of the pinned `@finos/calm-schema`, so a schema bump moves the lessons too. */
export const CALM_SCHEMA_RELEASE = calmRelease(releases['../../node_modules/@finos/calm-schema/schema/calm.json']?.$id);

export const CALM_META_SCHEMA_BASE_URL = `https://calm.finos.org/release/${CALM_SCHEMA_RELEASE}/meta`;

const ALL = [
    ...Object.values(releases),
    draftCalm, draftCore, draftInterface, draftControl, draftControlRequirement, draftEvidence, draftFlow, draftUnits,
] as Array<{ $id: string }>;

export const SCHEMAS: Record<string, object> = Object.fromEntries(ALL.map((schema) => [schema.$id, schema]));
