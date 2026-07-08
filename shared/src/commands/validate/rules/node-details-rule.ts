import { SchemaDirectory } from '../../../schema-directory.js';
import { validateNodeDetails, ArchitectureValidator } from '../validate-node-details.js';
import { RuleResult, ValidationContext, ValidationPhase, ValidationRule } from '../validation-rule.js';
import { hasArchitectureAndDirectory } from './json-schema-rule.js';
import { CachingTrackingResolver } from '../../../resolver/caching-tracking-resolver.js';

/**
 * A model-backed, recursive {@link ValidationRule}: validates each node's referenced
 * detailed-architecture by re-entering the engine for the sub-architecture. The shared
 * {@link CachingTrackingResolver} caches loaded documents and tracks visited references, providing
 * cycle safety across the recursion.
 */
export class NodeDetailsValidationRule implements ValidationRule {
    readonly id = 'node-details';
    readonly description = 'Recursively validate referenced detailed-architecture sub-documents';
    readonly phase = ValidationPhase.RECURSIVE;

    appliesTo(context: ValidationContext): boolean {
        return hasArchitectureAndDirectory(context);
    }

    async run(context: ValidationContext): Promise<RuleResult> {
        // Re-enter the engine for each sub-architecture, threading the shared caching/tracking
        // resolver and deriving the mode from whether a pattern was resolved — reproducing the
        // historical dispatch between the with-pattern and pattern-less flows.
        const recursiveValidator: ArchitectureValidator = (arch, pattern, dir: SchemaDirectory, dbg, references: CachingTrackingResolver) =>
            context.engine.validate({
                architecture: arch,
                pattern,
                timeline: undefined,
                mode: pattern !== undefined ? 'architecture-with-pattern' : 'architecture-only',
                schemaDirectory: dir,
                references,
                debug: dbg,
                engine: context.engine
            });

        const result = await validateNodeDetails(
            context.architecture!,
            context.schemaDirectory!,
            context.debug,
            recursiveValidator,
            context.references
        );

        return {
            jsonSchemaOutputs: result.jsonSchemaOutputs,
            spectralOutputs: result.spectralOutputs,
            hasErrors: result.hasErrors,
            hasWarnings: result.hasWarnings
        };
    }
}
