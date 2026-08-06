import type { ValidationIssue } from '../stores/canvas-store';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';
import { validateCalmArchitecture } from '../../core/validation.js';

interface ControlRequirement {
    config?: { value?: string };
}

interface ControlValidationMeta {
    pattern?: string;
    'allowed-values'?: string[];
    example?: string;
}

interface ControlEntry {
    requirements?: ControlRequirement[];
    metadata?: { validation?: ControlValidationMeta };
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
    if (!validation) return [];

    const value = control?.requirements?.[0]?.config?.value ?? '';
    const allowed = validation['allowed-values'];
    const pattern = validation.pattern;
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
