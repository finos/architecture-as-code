// Pure, framework-free helpers for building and enriching CALM control entries.
// Shared by ControlsList (rendering), App (attach + webview enrichment), the
// ControlPicker, and StandardNodeCreator so control shape logic lives in one
// testable place.

import type {
    ParsedRequirement,
    RequirementIdentity,
} from '../../extension/services/requirement-parser';

export interface ControlRequirement {
    'requirement-url'?: string;
    'config-url'?: string;
    config?: Record<string, unknown>;
}

export interface ControlEntry {
    description?: string;
    requirements?: ControlRequirement[];
}

/** Base fields seeded into inline config from a requirement's identity constants. */
export function seedBaseConstants(
    identity: RequirementIdentity
): Record<string, string> {
    return {
        'control-id': identity.controlId,
        name: identity.name,
        description: identity.description,
    };
}

/** The first requirement's `requirement-url`, if any. */
export function getRequirementUrl(control: ControlEntry): string | undefined {
    return control?.requirements?.[0]?.['requirement-url'];
}

/** Whether the first requirement pins a `config-url` (inline config is then read-only). */
export function hasConfigUrl(control: ControlEntry): boolean {
    return typeof control?.requirements?.[0]?.['config-url'] === 'string';
}

/** Read a per-property inline config value from the first requirement. */
export function getPropertyValue(
    control: ControlEntry,
    propName: string
): unknown {
    return control?.requirements?.[0]?.config?.[propName];
}

/** Immutably set a per-property inline config value on the first requirement. */
export function setPropertyValue(
    control: ControlEntry,
    propName: string,
    value: unknown
): ControlEntry {
    const reqs = [...(control.requirements ?? [])];
    if (reqs.length === 0) reqs.push({ 'requirement-url': '' });
    const config = { ...(reqs[0].config ?? {}) };
    if (value === undefined) {
        delete config[propName];
    } else {
        config[propName] = value;
    }
    reqs[0] = { ...reqs[0], config };
    return { ...control, requirements: reqs };
}

/**
 * Build a fresh control entry from a resolved requirement and its reference.
 * Seeds base identity constants into the inline config so `calm validate` accepts it.
 */
export function buildControlEntry(
    ref: string,
    parsed: ParsedRequirement
): ControlEntry {
    return {
        description: parsed.identity.description,
        requirements: [
            {
                'requirement-url': ref,
                config: seedBaseConstants(parsed.identity),
            },
        ],
    };
}

/**
 * Seed any missing base constants into an existing control entry — preserving
 * values the user has already filled in. Used by the webview enrichment flow
 * after `requestControlResolve` succeeds.
 */
export function enrichControlWithRequirement(
    control: ControlEntry,
    parsed: ParsedRequirement
): ControlEntry {
    const reqs = [...(control.requirements ?? [])];
    if (reqs.length === 0) reqs.push({ 'requirement-url': '' });
    if (!reqs[0]['config-url']) {
        const config = { ...(reqs[0].config ?? {}) };
        const base = seedBaseConstants(parsed.identity);
        for (const [k, v] of Object.entries(base)) {
            if (config[k] === undefined) config[k] = v;
        }
        reqs[0] = { ...reqs[0], config };
    }

    const description =
        !control.description || control.description.trim() === ''
            ? parsed.identity.description
            : control.description;

    const { metadata: _ignoredMetadata, ...rest } = control as ControlEntry & {
        metadata?: unknown;
    };
    return {
        ...rest,
        description,
        requirements: reqs,
    };
}

/**
 * Whether a control needs enrichment: it has a `requirement-url` that has not
 * been resolved into canvas state yet, or its base identity constants /
 * description have not been seeded.
 */
export function needsEnrichment(
    control: ControlEntry,
    resolvedRequirements?: Record<string, ParsedRequirement>
): boolean {
    const ref = getRequirementUrl(control);
    if (!ref) return false;
    if (resolvedRequirements && !resolvedRequirements[ref]) return true;
    if (hasConfigUrl(control)) return false;
    if (!control.description || control.description.trim() === '') return true;
    const config = control?.requirements?.[0]?.config;
    return Boolean(
        !config ||
            config['control-id'] === undefined ||
            config.name === undefined ||
            config.description === undefined
    );
}

/** Sort ascending Hub versions and return the latest (last element), or undefined. */
export function latestVersion(versions: string[]): string | undefined {
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
}
