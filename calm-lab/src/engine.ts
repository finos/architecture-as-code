import {
    validate,
    formatOutput,
    SchemaDirectory,
    buildBrowserDocumentLoader,
    diffDocuments,
    browserSupportFor,
    type BrowserCommandSupport,
    type ValidationOutcome,
    type ValidationOutput,
} from '@finos/calm-shared/browser';
import sharedPackage from '../../shared/package.json';
import { SCHEMAS } from './schemas';

export type LabSeverity = 'error' | 'warning' | 'info' | 'hint';
export interface LabIssue { severity: LabSeverity; path: string; message: string; code: string }
export interface LabValidation { ok: boolean; parseError?: string; issues: LabIssue[]; errors: LabIssue[]; pretty: string; doc?: object }
export interface LabDiff { formatted: string; hasChanges: boolean }
export class LabError extends Error {}

export const DEFAULT_SCHEMA_ID = 'https://calm.finos.org/release/1.2/meta/calm.json';
export const ENGINE_VERSION: string = sharedPackage.version;
const MAX_ISSUES = 20;

let directoryPromise: Promise<SchemaDirectory> | undefined;

async function loadSchemaDirectory(): Promise<SchemaDirectory> {
    const directory = new SchemaDirectory(buildBrowserDocumentLoader({ documents: SCHEMAS, allowRemote: false }));
    await directory.loadSchemas();
    return directory;
}

/** One SchemaDirectory for the session, seeded with the bundled meta-schemas; no remote loading. */
function schemaDirectory(): Promise<SchemaDirectory> {
    if (!directoryPromise) {
        const pending = loadSchemaDirectory();
        directoryPromise = pending;
        // Never memoise a failure: a rejected promise would disable validation
        // for the rest of the session, with no way back but a reload.
        pending.catch(() => {
            if (directoryPromise === pending) {
                directoryPromise = undefined;
            }
        });
    }
    return directoryPromise;
}

function parseJson(text: string, label: string): object {
    try {
        return JSON.parse(text) as object;
    } catch (error) {
        throw new LabError(`${label} is not valid JSON — ${(error as Error).message}`);
    }
}

function toSeverity(value: string): LabSeverity {
    return value === 'error' || value === 'warning' || value === 'info' || value === 'hint' ? value : 'error';
}

function toIssues(outcome: ValidationOutcome): LabIssue[] {
    const ordered: ValidationOutput[] = [...outcome.jsonSchemaValidationOutputs, ...outcome.spectralSchemaValidationOutputs];
    const rank: Record<LabSeverity, number> = { error: 0, warning: 1, info: 2, hint: 3 };
    ordered.sort((a, b) => rank[toSeverity(a.severity)] - rank[toSeverity(b.severity)]);
    const seen = new Set<string>();
    const issues: LabIssue[] = [];
    for (const output of ordered) {
        const path = output.path || '/';
        const message = output.message ?? 'is invalid';
        const key = `${path}|${message}`;
        if (seen.has(key) || issues.length >= MAX_ISSUES) {
            continue;
        }
        seen.add(key);
        issues.push({ severity: toSeverity(output.severity), path, message, code: String(output.code ?? '') });
    }
    return issues;
}

/** Validate an architecture document with the real CALM engine (JSON Schema + Spectral rules). */
export async function validateArchitecture(jsonText: string): Promise<LabValidation> {
    let doc: object;
    try {
        doc = parseJson(jsonText, 'This file');
    } catch (error) {
        return { ok: false, parseError: (error as Error).message, issues: [], errors: [], pretty: (error as Error).message };
    }
    const outcome = await validate(doc, undefined, undefined, await schemaDirectory());
    const issues = toIssues(outcome);
    return {
        ok: !outcome.hasErrors,
        issues,
        errors: issues.filter((issue) => issue.severity === 'error'),
        pretty: formatOutput(outcome, 'pretty'),
        doc,
    };
}

/** Diff two architecture documents (summary format), labelled with the file names for messages. */
export function diffArchitectures(aText: string, bText: string, labels: [string, string]): LabDiff {
    const a = parseJson(aText, labels[0]) as Record<string, unknown>;
    const b = parseJson(bText, labels[1]) as Record<string, unknown>;
    try {
        const result = diffDocuments(a, b, { format: 'summary', labels });
        return { formatted: result.formatted, hasChanges: result.hasChanges };
    } catch (error) {
        throw new LabError((error as Error).message);
    }
}

export function commandSupport(command: string): BrowserCommandSupport | undefined {
    return browserSupportFor(command);
}
