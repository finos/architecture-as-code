import {
    validate,
    formatOutput,
    SchemaDirectory,
    buildBrowserDocumentLoader,
    browserSupportFor,
    BROWSER_COMMAND_SUPPORT,
    type BrowserCommandSupport,
    type ValidationOutcome,
    type ValidationOutput,
} from '@finos/calm-shared/browser';
import { SCHEMAS } from './schemas';

export type LabSeverity = 'error' | 'warning' | 'info' | 'hint';
export interface LabIssue { severity: LabSeverity; path: string; message: string }
/**
 * `issues`/`errors` are capped at MAX_ISSUES for display; `issueCount` and
 * `errorCount` are the real totals, so nothing ever under-reports the problems
 * in a document.
 */
export interface LabValidation { ok: boolean; parseError?: string; issues: LabIssue[]; errors: LabIssue[]; issueCount: number; errorCount: number; pretty: string; doc?: object }
export class LabError extends Error {}

/** Injected by `define` in vite.config.ts — see src/vite-env.d.ts. */
export const ENGINE_VERSION: string = __CALM_SHARED_VERSION__;
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

/** Parses JSON with a `LabError` carrying the file label — shared by every command that reads editor buffers. */
export function parseJson(text: string, label: string): object {
    try {
        return JSON.parse(text) as object;
    } catch (error) {
        throw new LabError(`${label} is not valid JSON — ${(error as Error).message}`);
    }
}

function toSeverity(value: string): LabSeverity {
    return value === 'error' || value === 'warning' || value === 'info' || value === 'hint' ? value : 'error';
}

interface IssueSummary { issues: LabIssue[]; issueCount: number; errorCount: number }

function toIssues(outcome: ValidationOutcome): IssueSummary {
    const ordered: ValidationOutput[] = [...outcome.jsonSchemaValidationOutputs, ...outcome.spectralSchemaValidationOutputs];
    const rank: Record<LabSeverity, number> = { error: 0, warning: 1, info: 2, hint: 3 };
    ordered.sort((a, b) => rank[toSeverity(a.severity)] - rank[toSeverity(b.severity)]);
    const seen = new Set<string>();
    const issues: LabIssue[] = [];
    let issueCount = 0;
    let errorCount = 0;
    for (const output of ordered) {
        const path = output.path || '/';
        const message = output.message ?? 'is invalid';
        const key = `${path}|${message}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const severity = toSeverity(output.severity);
        issueCount += 1;
        if (severity === 'error') {
            errorCount += 1;
        }
        // Counting continues past the cap — the display is truncated, the totals are not.
        if (issues.length < MAX_ISSUES) {
            issues.push({ severity, path, message });
        }
    }
    return { issues, issueCount, errorCount };
}

/** Validate an architecture document with the real CALM engine (JSON Schema + Spectral rules). */
export async function validateArchitecture(jsonText: string): Promise<LabValidation> {
    let doc: object;
    try {
        doc = parseJson(jsonText, 'This file');
    } catch (error) {
        return { ok: false, parseError: (error as Error).message, issues: [], errors: [], issueCount: 1, errorCount: 1, pretty: (error as Error).message };
    }
    const outcome = await validate(doc, undefined, undefined, await schemaDirectory());
    const { issues, issueCount, errorCount } = toIssues(outcome);
    return {
        ok: !outcome.hasErrors,
        issues,
        errors: issues.filter((issue) => issue.severity === 'error'),
        issueCount,
        errorCount,
        pretty: formatOutput(outcome, 'pretty'),
        doc,
    };
}

export function commandSupport(command: string): BrowserCommandSupport | undefined {
    return browserSupportFor(command);
}

/** The `hub *` entries of the browser capability manifest, for `calm hub`'s listing. */
export function hubCommands(): readonly BrowserCommandSupport[] {
    return BROWSER_COMMAND_SUPPORT.filter((entry) => entry.command.startsWith('hub '));
}
