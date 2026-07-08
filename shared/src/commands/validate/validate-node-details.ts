import { CalmCore } from '@finos/calm-models/model';
import { SchemaDirectory } from '../../schema-directory.js';
import { ValidationOutput, ValidationOutcome } from './validation.output.js';
import { initLogger, Logger } from '../../logger.js';
import { getErrorMessage } from '../../error-utils.js';
import { tryParseCalmCore } from './calm-core-parse.js';
import { CachingTrackingResolver } from '../../resolver/caching-tracking-resolver.js';

type CalmNode = CalmCore['nodes'][number];

type NodeDetailResult = {
    jsonSchemaOutputs: ValidationOutput[],
    spectralOutputs: ValidationOutput[],
    hasErrors: boolean,
    hasWarnings: boolean
};

/**
 * Injectable recursive validator — allows validate-node-details to call back into the
 * main validation pipeline (two-phase Spectral + JSON-Schema) without creating a circular
 * module dependency with validate.ts.
 *
 * The single {@link CachingTrackingResolver} is threaded through unchanged so reference
 * caching and cycle/dedupe tracking are owned in exactly one place regardless of whether a
 * sub-architecture is validated with or without a pattern.
 */
export type ArchitectureValidator = (
    architecture: object,
    pattern: object | undefined,
    schemaDirectory: SchemaDirectory,
    debug: boolean,
    references: CachingTrackingResolver
) => Promise<ValidationOutcome>;

/**
 * Validate all node details in an architecture by recursively loading and validating any
 * referenced detailed-architecture sub-architectures.
 *
 * The raw sub-architecture document is loaded through the shared {@link CachingTrackingResolver},
 * which caches each document and records which references have been visited. Cycle safety and
 * "validate each sub-architecture once" both come from that tracking, so a cyclic
 * detailed-architecture terminates instead of recursing unbounded.
 *
 * Pattern resolution priority per node:
 *  1. `details.required-pattern` URL
 *  2. `$schema` field of the detailed-architecture document
 *  3. Neither found → recursiveValidator is called with an undefined pattern
 */
export async function validateNodeDetails(
    architecture: object,
    schemaDirectory: SchemaDirectory,
    debug: boolean,
    recursiveValidator: ArchitectureValidator,
    references: CachingTrackingResolver
): Promise<NodeDetailResult> {
    const logger = initLogger(debug, 'validate-node-details');
    const jsonSchemaOutputs: ValidationOutput[] = [];
    const spectralOutputs: ValidationOutput[] = [];
    let hasErrors = false;
    let hasWarnings = false;

    const calmCore = tryParseCalmCore(architecture, logger);
    if (!calmCore) {
        return { jsonSchemaOutputs, spectralOutputs, hasErrors, hasWarnings };
    }

    for (const [nodeIdx, node] of calmCore.nodes.entries()) {
        const result = await validateNodeDetail(node, nodeIdx, schemaDirectory, debug, recursiveValidator, references);
        jsonSchemaOutputs.push(...result.jsonSchemaOutputs);
        spectralOutputs.push(...result.spectralOutputs);
        if (result.hasErrors) hasErrors = true;
        if (result.hasWarnings) hasWarnings = true;
    }

    return { jsonSchemaOutputs, spectralOutputs, hasErrors, hasWarnings };
}

async function validateNodeDetail(
    node: CalmNode,
    nodeIdx: number,
    schemaDirectory: SchemaDirectory,
    debug: boolean,
    recursiveValidator: ArchitectureValidator,
    references: CachingTrackingResolver
): Promise<NodeDetailResult> {
    const logger = initLogger(debug, 'validate-node-details');
    const detailedArchitecture = node.details?.detailedArchitecture;
    const archUrl = detailedArchitecture?.reference;

    if (!detailedArchitecture || !archUrl) return emptyNodeResult();

    if (references.has(archUrl)) {
        logger.debug(`Cycle detected: skipping already-visited architecture '${archUrl}'`);
        return emptyNodeResult();
    }

    const detailsPrefix = `/nodes/${nodeIdx}/details/detailed-architecture`;

    const { subArch, error: loadError } = await loadSubArchitecture(references, archUrl, detailsPrefix);
    if (loadError) return nodeError(loadError);

    const pattern = await resolvePattern(node, subArch!, schemaDirectory, logger);

    // A cache-seeded fork isolates AJV schema-id compilation for the sub-architecture while
    // still reusing the parent's already-loaded base schemas (no redundant re-fetch).
    const freshDir = schemaDirectory.fork();

    const { outcome, error: validationError } = await runRecursiveValidator(
        subArch!, pattern, freshDir, debug, references, recursiveValidator, archUrl, detailsPrefix
    );
    if (validationError) return nodeError(validationError);

    return prefixedNodeResult(outcome!, detailsPrefix);
}

/**
 * Load the raw sub-architecture document through the shared {@link CachingTrackingResolver}.
 * Validation needs the raw JSON document (for Spectral + JSON-Schema), and the resolver both
 * caches it and records the reference as visited.
 */
async function loadSubArchitecture(
    references: CachingTrackingResolver,
    archUrl: string,
    detailsPrefix: string
): Promise<{ subArch?: object, error?: ValidationOutput }> {
    try {
        const subArch = await references.resolve(archUrl) as object;
        return { subArch };
    } catch (err) {
        return { error: nodeDetailsError(detailsPrefix, `Could not load detailed-architecture '${archUrl}': ${getErrorMessage(err)}`) };
    }
}

async function resolvePattern(
    node: CalmNode,
    subArch: object,
    schemaDirectory: SchemaDirectory,
    logger: Logger
): Promise<object | undefined> {
    if (node.details?.requiredPattern?.reference) {
        const pattern = await tryLoadSchema(node.details.requiredPattern.reference, schemaDirectory, logger, 'required-pattern');
        if (pattern) return pattern;
    }

    const schemaRef = (subArch as Record<string, unknown>)['$schema'] as string | undefined;
    if (schemaRef) {
        return tryLoadSchema(schemaRef, schemaDirectory, logger, '$schema');
    }

    return undefined;
}

async function tryLoadSchema(
    url: string,
    schemaDirectory: SchemaDirectory,
    logger: Logger,
    label: string
): Promise<object | undefined> {
    try {
        const schema = await schemaDirectory.getSchema(url);
        if (!schema) logger.debug(`Pattern from ${label} '${url}' not found in schema directory`);
        return schema;
    } catch (err) {
        logger.debug(`Could not load pattern from ${label} '${url}': ${getErrorMessage(err)}`);
        return undefined;
    }
}

async function runRecursiveValidator(
    subArch: object,
    pattern: object | undefined,
    freshDir: SchemaDirectory,
    debug: boolean,
    references: CachingTrackingResolver,
    recursiveValidator: ArchitectureValidator,
    archUrl: string,
    detailsPrefix: string
): Promise<{ outcome?: ValidationOutcome, error?: ValidationOutput }> {
    try {
        return { outcome: await recursiveValidator(subArch, pattern, freshDir, debug, references) };
    } catch (err) {
        return { error: nodeDetailsError(detailsPrefix, `Validation of detailed-architecture '${archUrl}' failed: ${getErrorMessage(err)}`) };
    }
}

function prefixedNodeResult(outcome: ValidationOutcome, prefix: string): NodeDetailResult {
    return {
        jsonSchemaOutputs: prefixOutputs(outcome.jsonSchemaValidationOutputs, prefix),
        spectralOutputs: prefixOutputs(outcome.spectralSchemaValidationOutputs, prefix),
        hasErrors: outcome.hasErrors,
        hasWarnings: outcome.hasWarnings
    };
}

function prefixOutputs(outputs: ValidationOutput[], prefix: string): ValidationOutput[] {
    return outputs.map(output => {
        const newPath = output.path === '/' ? prefix : prefix + output.path;
        return new ValidationOutput(
            output.code,
            output.severity,
            output.message,
            newPath,
            output.schemaPath,
            output.line_start,
            output.line_end,
            output.character_start,
            output.character_end,
            output.source
        );
    });
}

function emptyNodeResult(): NodeDetailResult {
    return { jsonSchemaOutputs: [], spectralOutputs: [], hasErrors: false, hasWarnings: false };
}

function nodeError(output: ValidationOutput): NodeDetailResult {
    return { jsonSchemaOutputs: [output], spectralOutputs: [], hasErrors: true, hasWarnings: false };
}

function nodeDetailsError(path: string, message: string): ValidationOutput {
    return ValidationOutput.error('node-details-validation', message, path, { source: 'architecture' });
}
