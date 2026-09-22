import type { ValidationIssue } from '../stores/canvas-store';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';
import { validateCalmArchitecture } from '../../core/validation.js';

interface ControlRequirement {
    config?: Record<string, unknown> & { value?: string };
    'requirement-url'?: string;
}

interface LegacyValidationMeta {
    pattern?: string;
    'allowed-values'?: string[];
    example?: string;
}

interface RequirementPropertyDef {
    type: 'string' | 'boolean' | 'number' | 'integer' | 'enum';
    allowedValues?: Array<string | number | boolean>;
    pattern?: string;
    description?: string;
    required: boolean;
}

interface NewValidationMeta {
    identity?: { controlId: string; name: string; description: string };
    properties?: Record<string, RequirementPropertyDef>;
}

type ControlValidationMeta = LegacyValidationMeta | NewValidationMeta;

interface ControlEntry {
    requirements?: ControlRequirement[];
    metadata?: { validation?: ControlValidationMeta };
}

function isNewValidation(v: ControlValidationMeta): v is NewValidationMeta {
    return !!v && typeof v === 'object' && 'properties' in v && !!v.properties;
}

/** A config value is "present" unless it is undefined, null, or an empty string. `false` and `0` count. */
function hasConfigValue(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

/**
 * Validate the per-property inline config of a control against its resolved
 * requirement property definitions (the new multi-property shape).
 */
export function validateControlProperties(
    controlId: string,
    properties: Record<string, RequirementPropertyDef>,
    control: ControlEntry,
    scopeLabel: string,
    nodeId?: string
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const config = (control?.requirements?.[0]?.config ?? {}) as Record<
        string,
        unknown
    >;

    for (const [propName, def] of Object.entries(properties)) {
        const value = config[propName];
        if (!hasConfigValue(value)) {
            if (def.required) {
                issues.push({
                    severity: 'error',
                    message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" is required`,
                    nodeId,
                    controlId,
                });
            }
            continue;
        }

        if (
            def.type === 'enum' &&
            def.allowedValues &&
            !def.allowedValues.includes(value as string | number | boolean)
        ) {
            issues.push({
                severity: 'error',
                message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" value "${String(value)}" is not allowed (one of: ${def.allowedValues.join(', ')})`,
                nodeId,
                controlId,
            });
        }

        if (def.type === 'string' && def.pattern) {
            let matches = true;
            try {
                matches = new RegExp(def.pattern).test(String(value));
            } catch {
                matches = true; // malformed pattern — don't punish the user
            }
            if (!matches) {
                issues.push({
                    severity: 'error',
                    message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" value "${String(value)}" does not match pattern ${def.pattern}`,
                    nodeId,
                    controlId,
                });
            }
        }

        if (
            (def.type === 'number' || def.type === 'integer') &&
            typeof value !== 'number'
        ) {
            issues.push({
                severity: 'error',
                message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" must be a number`,
                nodeId,
                controlId,
            });
        } else if (
            def.type === 'integer' &&
            typeof value === 'number' &&
            !Number.isInteger(value)
        ) {
            issues.push({
                severity: 'error',
                message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" must be an integer`,
                nodeId,
                controlId,
            });
        }

        if (def.type === 'boolean' && typeof value !== 'boolean') {
            issues.push({
                severity: 'error',
                message: `Control "${controlId}" on ${scopeLabel}: property "${propName}" must be true or false`,
                nodeId,
                controlId,
            });
        }
    }

    return issues;
}

/**
 * Validate a single control's configured value against its `metadata.validation`
 * constraints (allowed-values or regex pattern). Returns a warning when a
 * constrained control has no value, and an error when the value violates the
 * constraint.
 */
export function validateControlConfig(
    controlId: string,
    control: ControlEntry,
    scopeLabel: string,
    nodeId?: string
): ValidationIssue[] {
    const validation = control?.metadata?.validation;

    // New multi-property shape — validate each property's inline config value.
    if (validation && isNewValidation(validation)) {
        return validateControlProperties(
            controlId,
            validation.properties ?? {},
            control,
            scopeLabel,
            nodeId
        );
    }

    const requirementUrl = control?.requirements?.[0]?.['requirement-url'] as string | undefined;
    const value = control?.requirements?.[0]?.config?.value ?? '';

    // If control has a requirement-url (CURIE) but no config value, flag as unconfigured
    if (!validation && requirementUrl && !value) {
        return [{
            severity: 'error',
            message: `Control "${controlId}" on ${scopeLabel} is not configured`,
            nodeId,
            controlId,
        }];
    }
    if (!validation) return [];
    const legacy = validation as LegacyValidationMeta;
    const allowed = legacy['allowed-values'];
    const pattern = legacy.pattern;
    const issues: ValidationIssue[] = [];

    if (!value) {
        const hint = allowed?.length
            ? ` (allowed: ${allowed.join(', ')})`
            : pattern
              ? ` (pattern: ${pattern})`
              : '';
        issues.push({
            severity: 'error',
            message: `Control "${controlId}" on ${scopeLabel} is not configured${hint}`,
            nodeId,
            controlId,
        });
        return issues;
    }

    if (allowed?.length && !allowed.includes(value)) {
        issues.push({
            severity: 'error',
            message: `Control "${controlId}" on ${scopeLabel}: "${value}" is not an allowed value (must be one of: ${allowed.join(', ')})`,
            nodeId,
            controlId,
        });
    }

    if (pattern) {
        let matches = true;
        try {
            matches = new RegExp(pattern).test(value);
        } catch {
            matches = true; // malformed pattern in the standard — don't punish the user
        }
        if (!matches) {
            issues.push({
                severity: 'error',
                message: `Control "${controlId}" on ${scopeLabel}: "${value}" does not match required pattern ${pattern}`,
                nodeId,
                controlId,
            });
        }
    }

    return issues;
}

/**
 * Control-requirement validation: for every non-reference node (and the
 * solution-level controls), check each control's configured value against its
 * `metadata.validation` (allowed-values / pattern). Structural/schema validation
 * is handled separately by calm-core.
 */
export function validateControls(arch: CalmArchitecture): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of arch.nodes ?? []) {
        const controls = node.controls as
            | Record<string, ControlEntry>
            | undefined;
        if (!controls) continue;
        const id = node['unique-id'] as string | undefined;
        const name = node.name as string | undefined;
        const label = `"${name || id}"`;
        for (const [controlId, control] of Object.entries(controls)) {
            issues.push(
                ...validateControlConfig(controlId, control, label, id)
            );
        }
    }

    const docControls = arch.controls as
        | Record<string, ControlEntry>
        | undefined;
    if (docControls) {
        for (const [controlId, control] of Object.entries(docControls)) {
            issues.push(
                ...validateControlConfig(controlId, control, 'the solution')
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
    arch: CalmArchitecture
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    try {
        issues.push(
            ...(validateCalmArchitecture(arch as any) as ValidationIssue[])
        );
    } catch {
        // calm-core threw on malformed input — the control checks below still run.
    }
    issues.push(...validateControls(arch));
    // Surface errors first, then warnings, then info.
    const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    return issues;
}
