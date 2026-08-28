import { initLogger, Logger } from '../../logger.js';
import { ValidationOutcome } from './validation.output.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { ValidationContext, ValidationMode } from './validation-rule.js';
import { createDefaultValidationEngine, ValidationEngine } from './validation-engine.js';
import { CachingTrackingResolver } from '../../resolver/caching-tracking-resolver.js';
import { SchemaDirectoryReferenceResolver } from '../../resolver/schema-directory-reference-resolver.js';

let logger: Logger; // defined later at startup

/**
 * Asserts that a schema directory was provided. Validating a pattern, a timeline,
 * or an architecture against a pattern all require schema resolution, so a missing
 * directory is a caller error rather than a recoverable condition.
 */
function assertSchemaDirectory(schemaDirectory: SchemaDirectory | undefined): asserts schemaDirectory is SchemaDirectory {
    if (!schemaDirectory) {
        throw new Error('A schema directory is required for schema validation');
    }
}

/**
 * Validation - with simple input parameters and output validation outcomes.
 *
 * The input combination is resolved to a {@link ValidationMode} and a {@link ValidationContext},
 * which the {@link ValidationEngine} runs through the registered rules (Spectral linting,
 * JSON-Schema, controls and recursive node-details).
 *
 * @param architecture The architecture as a JS object, or undefined if not provided
 * @param patternOrSchema The pattern (or schema) as a JS object, or undefined if not provided
 * @param timeline The timeline as a JS object, or undefined if not provided
 * @param schemaDirectory SchemaDirectory instance for schema resolution
 * @param debug Whether to log at debug level
 * @returns Validation report
 */
export async function validate(
    architecture: object | undefined,
    patternOrSchema: object | undefined,
    timeline: object | undefined,
    schemaDirectory?: SchemaDirectory,
    debug: boolean = false
): Promise<ValidationOutcome> {
    logger = initLogger(debug, 'calm-validate');

    try {
        const engine = createDefaultValidationEngine();
        const context = buildValidationContext(architecture, patternOrSchema, timeline, schemaDirectory, debug, engine);
        return await engine.validate(context);
    } catch (error) {
        logger.error('An error occurred:' + error);
        throw error;
    }
}

/**
 * Resolve the input combination to a mode + context, preserving the historical caller-error
 * throws for invalid combinations.
 */
function buildValidationContext(
    architecture: object | undefined,
    patternOrSchema: object | undefined,
    timeline: object | undefined,
    schemaDirectory: SchemaDirectory | undefined,
    debug: boolean,
    engine: ValidationEngine
): ValidationContext {
    const references = new CachingTrackingResolver(new SchemaDirectoryReferenceResolver(schemaDirectory));
    const base = { references, debug, engine };

    if (timeline) {
        if (architecture) {
            throw new Error('You cannot provide an architecture when validating a timeline');
        }
        if (!patternOrSchema) {
            throw new Error('You must provide a schema to validate the timeline against, or the timeline must reference it internally');
        }
        // It is acceptable, in fact desired, for `patternOrSchema` to be set, and be the CALM timeline schema.
        assertSchemaDirectory(schemaDirectory);
        return { ...base, mode: 'timeline' as ValidationMode, timeline, pattern: patternOrSchema, schemaDirectory };
    } else if (architecture && patternOrSchema) {
        // Note that patternOrSchema may be a CALM pattern, or might be the CALM core schema.
        assertSchemaDirectory(schemaDirectory);
        return { ...base, mode: 'architecture-with-pattern' as ValidationMode, architecture, pattern: patternOrSchema, schemaDirectory };
    } else if (patternOrSchema) {
        // `patternOrSchema` should really be a CALM pattern in this case.
        assertSchemaDirectory(schemaDirectory);
        return { ...base, mode: 'pattern-only' as ValidationMode, pattern: patternOrSchema, schemaDirectory };
    } else if (architecture) {
        return { ...base, mode: 'architecture-only' as ValidationMode, architecture, schemaDirectory };
    }

    logger.debug('You must provide an architecture, a pattern, or a timeline');
    throw new Error('You must provide an architecture, a pattern, or a timeline');
}
