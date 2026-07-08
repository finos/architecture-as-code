import { ErrorObject } from 'ajv/dist/2020.js';
import { Spectral, ISpectralDiagnostic, RulesetDefinition } from '@stoplight/spectral-core';
import { DiagnosticSeverity } from '@stoplight/types';
import { ValidationOutput } from './validation.output.js';
import { SpectralResult } from './spectral.result.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { selectChoices, CalmChoice } from '../generate/components/options.js';
import { initLogger, Logger } from '../../logger.js';

/**
 * Pure, stateless helpers shared by the validation orchestrator (`validate.ts`) and the
 * individual {@link ValidationRule} implementations. Kept in a dependency-free module so the
 * rules can import them without creating an import cycle back through `validate.ts`.
 */

export function prettifyJson(json: unknown): string {
    return JSON.stringify(json, null, 4);
}

export function stripRefs(obj: object): string {
    return JSON.stringify(obj).replaceAll('$ref', 'ref');
}

export function sortSpectralIssueBySeverity(issues: ISpectralDiagnostic[]): void {
    issues.sort((issue1: ISpectralDiagnostic, issue2: ISpectralDiagnostic) =>
        issue1.severity.valueOf() - issue2.severity.valueOf()
    );
}

/**
 * Run a single Spectral ruleset against a stringified document.
 */
export async function runSpectralValidations(
    schema: string,
    spectralRuleset: RulesetDefinition,
    source: string,
    logger: Logger = initLogger(false, 'calm-validate')
): Promise<SpectralResult> {
    let errors = false;
    let warnings = false;
    let spectralIssues: ValidationOutput[] = [];
    const spectral = new Spectral();

    spectral.setRuleset(spectralRuleset);
    const issues = await spectral.run(schema);

    if (issues && issues.length > 0) {
        logger.debug(`Spectral raw output: ${prettifyJson(issues)}`);
        sortSpectralIssueBySeverity(issues);
        spectralIssues = convertSpectralDiagnosticToValidationOutputs(issues, source);
        if (issues.filter(issue => issue.severity === 0).length > 0) {
            logger.debug('Spectral output contains errors');
            errors = true;
        }
        if (issues.filter(issue => issue.severity === 1).length > 0) {
            logger.debug('Spectral output contains warnings');
            warnings = true;
        }
    }
    return new SpectralResult(warnings, errors, spectralIssues);
}

/**
 * If a pattern contains options, apply the chosen options recorded in the architecture to the
 * pattern to produce a JSON schema pattern that can be used for validation.
 */
export function applyArchitectureOptionsToPattern(architecture: object, pattern: object, debug: boolean): object {
    const choices: CalmChoice[] = extractChoicesFromArchitecture(architecture);
    if (choices.length === 0) {
        return pattern;
    }
    return selectChoices(pattern, choices, debug);
}

export function extractChoicesFromArchitecture(architecture: object): CalmChoice[] {
    if (!architecture || !Object.prototype.hasOwnProperty.call(architecture, 'relationships')) {
        return [];
    }

    // architecture is unvalidated CALM JSON traversed via nested property access,
    // so a permissive index type is used here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relationships = (architecture as Record<string, any>)['relationships'] as Record<string, any>[];

    return relationships
        .filter((rel) => rel['relationship-type'] && Object.prototype.hasOwnProperty.call(rel['relationship-type'], 'options'))
        .map((rel) => rel['relationship-type']['options'][0])
        .map((rel) => ({
            description: rel['description'],
            nodes: rel['nodes'] || [],
            relationships: rel['relationships'] || []
        }));
}

/**
 * Finds the URL of the most recent CALM core schema loaded in the schema directory.
 *
 * Precedence: release > draft. Within each tier, URLs are compared with a numeric-aware locale
 * sort so that 1.10 > 1.9 > 1.2. Returns undefined if no CALM core schema is loaded.
 */
export function findLatestCalmCoreSchemaUrl(schemaDirectory: SchemaDirectory): string | undefined {
    const coreSchemaPattern = /calm\.finos\.org\/.*\/meta\/core\.json$/;
    const matches = schemaDirectory.getLoadedSchemas()
        .filter(id => coreSchemaPattern.test(id));

    if (matches.length === 0) return undefined;

    return matches.sort((a, b) => {
        const isRelease = (url: string) => url.includes('/release/');
        if (isRelease(a) !== isRelease(b)) return isRelease(a) ? -1 : 1;
        return b.localeCompare(a, undefined, { numeric: true });
    })[0];
}

export function convertJsonSchemaIssuesToValidationOutputs(jsonSchemaIssues: ErrorObject[], source: string): ValidationOutput[] {
    return jsonSchemaIssues.map(issue => {
        const rawPath = issue.instancePath ?? '';
        const path = rawPath === '' ? '/' : rawPath;
        return ValidationOutput.error('json-schema', appendExpected(issue), path, {
            schemaPath: issue.schemaPath,
            source
        });
    });
}

export function convertSpectralDiagnosticToValidationOutputs(spectralIssues: ISpectralDiagnostic[], source: string): ValidationOutput[] {
    const validationOutput: ValidationOutput[] = [];

    spectralIssues.forEach(issue => {
        const startRange = issue.range.start;
        const endRange = issue.range.end;
        const formattedIssue = new ValidationOutput(
            issue.code,
            getSeverity(issue.severity),
            issue.message,
            '/' + issue.path.join('/'),
            '',
            startRange.line,
            endRange.line,
            startRange.character,
            endRange.character,
            source
        );
        validationOutput.push(formattedIssue);
    });

    return validationOutput;
}

function getSeverity(spectralSeverity: DiagnosticSeverity): string {
    switch (spectralSeverity) {
    case 0:
        return 'error';
    case 1:
        return 'warning';
    case 2:
        return 'info';
    case 3:
        return 'hint';
    default:
        throw Error('The spectralSeverity does not match the known values');
    }
}

function appendExpected(issue: ErrorObject): string {
    if (!issue || !issue.params) {
        return issue?.message ?? '';
    }

    const params = issue.params as Record<string, unknown>;

    // const keyword: prefer params.allowedValue, fall back to schema (AJV sets schema to the const value)
    if (issue.keyword === 'const') {
        const allowed = 'allowedValue' in params ? params['allowedValue'] : (issue as unknown as { schema?: unknown }).schema;
        if (allowed !== undefined) {
            return `${issue.message} (expected ${safeStringify(allowed)})`;
        }
    }

    // enum keyword: prefer params.allowedValues, fall back to schema array
    if (issue.keyword === 'enum') {
        const allowedValues = 'allowedValues' in params ? params['allowedValues'] : (issue as unknown as { schema?: unknown }).schema;
        if (Array.isArray(allowedValues)) {
            return `${issue.message} (expected one of ${safeStringify(allowedValues)})`;
        }
    }

    return issue.message ?? '';
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch (_) {
        return String(value);
    }
}
