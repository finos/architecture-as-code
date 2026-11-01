import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { useCanvasStore, type ValidationIssue } from '../stores/canvas-store';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';
import type {
    ParsedRequirement,
    RequirementIdentity,
} from '../../extension/services/requirement-parser';
import {
    type ControlEntry,
    getRequirementUrl,
    hasConfigUrl,
    seedBaseConstants,
} from '../panels/control-metadata';
import { validateCalmArchitecture } from '../../core/validation.js';

export type RequirementSource = ParsedRequirement | Record<string, unknown>;

const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
});
const applyFormats =
    typeof addFormats === 'function'
        ? addFormats
        : (addFormats as { default: typeof addFormats }).default;
applyFormats(ajv);

/** A config value is "present" unless it is undefined, null, or an empty string. `false` and `0` count. */
function hasConfigValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

function hasAnyConfigValue(config: Record<string, unknown> | undefined): boolean {
    if (!config) return false;
    return Object.values(config).some(hasConfigValue);
}

function isParsedRequirement(req: RequirementSource): req is ParsedRequirement {
    const candidate = req as ParsedRequirement;
    return (
        !!candidate &&
        typeof candidate === 'object' &&
        !!candidate.identity &&
        typeof candidate.identity === 'object' &&
        typeof candidate.identity.controlId === 'string' &&
        !!candidate.properties &&
        typeof candidate.properties === 'object'
    );
}

function buildSchemaFromParsed(parsed: ParsedRequirement): Record<string, unknown> {
    const properties: Record<string, unknown> = {
        'control-id': { const: parsed.identity.controlId },
        name: { const: parsed.identity.name },
        description: { const: parsed.identity.description },
    };
    const required: string[] = ['control-id', 'name', 'description'];

    for (const [propName, def] of Object.entries(parsed.properties)) {
        if (def.required) required.push(propName);
        if (def.type === 'enum' && def.allowedValues) {
            properties[propName] = { enum: def.allowedValues };
        } else {
            const propSchema: Record<string, unknown> = { type: def.type };
            if (def.pattern) propSchema.pattern = def.pattern;
            properties[propName] = propSchema;
        }
    }

    return {
        type: 'object',
        properties,
        required,
    };
}

function extractConstString(prop: unknown): string | undefined {
    if (prop && typeof prop === 'object' && 'const' in prop) {
        const val = (prop as Record<string, unknown>).const;
        return typeof val === 'string' ? val : undefined;
    }
    return undefined;
}

function toSchemaAndIdentity(req: RequirementSource): {
    schema: Record<string, unknown>;
    identity?: RequirementIdentity;
} {
    if (isParsedRequirement(req)) {
        return {
            schema: req.schema ?? buildSchemaFromParsed(req),
            identity: req.identity,
        };
    }

    const props =
        req.properties && typeof req.properties === 'object'
            ? (req.properties as Record<string, unknown>)
            : undefined;
    const controlId = extractConstString(props?.['control-id']);
    const name = extractConstString(props?.name);
    const description = extractConstString(props?.description);
    const identity =
        controlId && name && description
            ? { controlId, name, description }
            : undefined;

    return { schema: req, identity };
}

/**
 * Validate a single control's inline `config` against its requirement JSON Schema
 * using Ajv.
 */
export function validateControlConfig(
    controlId: string,
    control: ControlEntry,
    scopeLabel: string,
    nodeId?: string,
    requirement?: RequirementSource | Record<string, RequirementSource>
): ValidationIssue[] {
    const requirementUrl = getRequirementUrl(control);
    let resolved: RequirementSource | undefined;
    if (requirement) {
        if (
            requirementUrl &&
            typeof requirement === 'object' &&
            requirementUrl in requirement
        ) {
            resolved = (requirement as Record<string, RequirementSource>)[
                requirementUrl
            ];
        } else if (
            isParsedRequirement(requirement as RequirementSource) ||
            'properties' in requirement ||
            '$schema' in requirement ||
            'type' in requirement
        ) {
            resolved = requirement as RequirementSource;
        }
    } else if (requirementUrl) {
        resolved = useCanvasStore.getState().resolvedRequirements[requirementUrl];
    }
    const rawConfig = control?.requirements?.[0]?.config;

    if (hasConfigUrl(control) && !rawConfig) {
        return [];
    }

    if (!resolved) {
        if (requirementUrl && !hasAnyConfigValue(rawConfig)) {
            return [
                {
                    severity: 'error',
                    message: `Control "${controlId}" on ${scopeLabel} is not configured`,
                    nodeId,
                    controlId,
                },
            ];
        }
        return [];
    }

    const { schema, identity } = toSchemaAndIdentity(resolved);
    const effectiveConfig: Record<string, unknown> = {
        ...(identity ? seedBaseConstants(identity) : {}),
    };
    for (const [k, v] of Object.entries(rawConfig ?? {})) {
        if (hasConfigValue(v)) {
            effectiveConfig[k] = v;
        } else {
            delete effectiveConfig[k];
        }
    }

    const { $schema: _ignoredSchema, $id: _ignoredId, ...compileTarget } = schema;
    let validate: ReturnType<typeof ajv.compile>;
    try {
        validate = ajv.compile(compileTarget);
    } catch {
        return [];
    }

    const valid = validate(effectiveConfig);
    if (valid || !validate.errors) return [];

    const issues: ValidationIssue[] = [];
    for (const err of validate.errors) {
        let message: string;
        if (
            err.keyword === 'required' &&
            typeof (err.params as { missingProperty?: unknown })?.missingProperty ===
                'string'
        ) {
            const prop = (err.params as { missingProperty: string }).missingProperty;
            message = `Control "${controlId}" on ${scopeLabel}: property "${prop}" is required`;
        } else if (
            err.keyword === 'enum' &&
            Array.isArray((err.params as { allowedValues?: unknown[] })?.allowedValues)
        ) {
            const prop = err.instancePath.replace(/^\//, '');
            const allowed = (
                err.params as { allowedValues: unknown[] }
            ).allowedValues.join(', ');
            message = prop
                ? `Control "${controlId}" on ${scopeLabel}: property "${prop}" is not allowed (must be one of: ${allowed})`
                : `Control "${controlId}" on ${scopeLabel}: ${err.message ?? 'value is not allowed'} (${allowed})`;
        } else if (
            err.keyword === 'pattern' &&
            typeof (err.params as { pattern?: unknown })?.pattern === 'string'
        ) {
            const prop = err.instancePath.replace(/^\//, '');
            const pat = (err.params as { pattern: string }).pattern;
            message = prop
                ? `Control "${controlId}" on ${scopeLabel}: property "${prop}" does not match pattern "${pat}"`
                : `Control "${controlId}" on ${scopeLabel}: value does not match pattern "${pat}"`;
        } else {
            const prop = err.instancePath.replace(/^\//, '');
            message = prop
                ? `Control "${controlId}" on ${scopeLabel}: property "${prop}" ${err.message ?? 'is invalid'}`
                : `Control "${controlId}" on ${scopeLabel}: ${err.message ?? 'invalid configuration'}`;
        }

        issues.push({
            severity: 'error',
            message,
            nodeId,
            controlId,
        });
    }

    return issues;
}

/**
 * Control-requirement validation: for every node (and the architecture-level
 * controls), validate each control's `config` against its requirement schema.
 * Structural/schema validation is handled separately by calm-core.
 */
export function validateControls(
    arch: CalmArchitecture,
    requirements?: Record<string, RequirementSource>
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const reqMap =
        requirements ?? useCanvasStore.getState().resolvedRequirements;

    for (const node of arch.nodes ?? []) {
        const controls = node.controls as
            | Record<string, ControlEntry>
            | undefined;
        if (!controls) continue;
        const id = node['unique-id'] as string | undefined;
        const name = node.name as string | undefined;
        const label = `"${name || id}"`;
        for (const [controlId, control] of Object.entries(controls)) {
            const url = getRequirementUrl(control);
            const req = url ? reqMap?.[url] : undefined;
            issues.push(
                ...validateControlConfig(controlId, control, label, id, req)
            );
        }
    }

    const docControls = arch.controls as
        | Record<string, ControlEntry>
        | undefined;
    if (docControls) {
        for (const [controlId, control] of Object.entries(docControls)) {
            const url = getRequirementUrl(control);
            const req = url ? reqMap?.[url] : undefined;
            issues.push(
                ...validateControlConfig(
                    controlId,
                    control,
                    'the architecture',
                    undefined,
                    req
                )
            );
        }
    }

    return issues;
}

/**
 * Full canvas validation: CALM 1.2 meta-schema + semantic rules (via calm-core)
 * combined with the control-requirement checks. calm-core owns
 * structural validation (missing unique-id/name, dangling refs, duplicates, …).
 */
export function validateArchitecture(
    arch: CalmArchitecture,
    requirements?: Record<string, RequirementSource>
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    try {
        issues.push(
            ...(validateCalmArchitecture(arch as any) as ValidationIssue[])
        );
    } catch {
        // calm-core threw on malformed input — the control checks below still run.
    }
    issues.push(...validateControls(arch, requirements));
    // Surface errors first, then warnings, then info.
    const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    return issues;
}
