// Pure, framework-free helpers for building and enriching CALM control entries.
// Shared by ControlsList (rendering), App (attach + webview enrichment), the
// ControlPicker, and BuildingBlockCreator so control shape logic lives in one
// testable place.

import type {
    ParsedRequirement,
    RequirementIdentity,
    RequirementPropertyDef,
} from '../../extension/services/requirement-parser';

export interface ControlRequirement {
    'requirement-url'?: string;
    'config-url'?: string;
    config?: Record<string, unknown>;
}

export interface NewControlMetadata {
    identity: RequirementIdentity;
    properties: Record<string, RequirementPropertyDef>;
}

export interface ControlEntry {
    description?: string;
    requirements?: ControlRequirement[];
    metadata?: { validation?: unknown };
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

/** Discriminate the new multi-property metadata shape from the legacy single-value one. */
export function isNewControlMetadata(
    validation: unknown
): validation is NewControlMetadata {
    return (
        !!validation &&
        typeof validation === 'object' &&
        'properties' in (validation as Record<string, unknown>) &&
        !!(validation as NewControlMetadata).properties
    );
}

/** True when the control still uses the legacy single `config.value` shape. */
export function isLegacyControl(control: ControlEntry): boolean {
    return !isNewControlMetadata(control?.metadata?.validation);
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
    config[propName] = value;
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
        metadata: {
            validation: {
                identity: parsed.identity,
                properties: parsed.properties,
            },
        },
    };
}

/**
 * Attach resolved requirement metadata to an existing control entry and seed any
 * missing base constants — preserving values the user has already filled in.
 * Used by the webview enrichment flow after `requestControlResolve` succeeds.
 */
export function enrichControlWithRequirement(
    control: ControlEntry,
    parsed: ParsedRequirement
): ControlEntry {
    const reqs = [...(control.requirements ?? [])];
    if (reqs.length === 0) reqs.push({ 'requirement-url': '' });
    const config = { ...(reqs[0].config ?? {}) };
    const base = seedBaseConstants(parsed.identity);
    for (const [k, v] of Object.entries(base)) {
        if (config[k] === undefined) config[k] = v;
    }
    reqs[0] = { ...reqs[0], config };

    const description =
        !control.description || control.description.trim() === ''
            ? parsed.identity.description
            : control.description;

    return {
        ...control,
        description,
        requirements: reqs,
        metadata: {
            ...(control.metadata ?? {}),
            validation: {
                identity: parsed.identity,
                properties: parsed.properties,
            },
        },
    };
}

/** Whether a control needs enrichment: it has a requirement-url but no resolved property metadata. */
export function needsEnrichment(control: ControlEntry): boolean {
    if (!getRequirementUrl(control)) return false;
    const validation = control?.metadata?.validation;
    if (!isNewControlMetadata(validation)) return true;
    return Object.keys(validation.properties).length === 0;
}

/** Sort ascending Hub versions and return the latest (last element), or undefined. */
export function latestVersion(versions: string[]): string | undefined {
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
}
