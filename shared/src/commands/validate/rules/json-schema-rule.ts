import { initLogger, Logger } from '../../../logger.js';
import { getErrorMessage } from '../../../error-utils.js';
import { SchemaDirectory } from '../../../schema-directory.js';
import { JsonSchemaValidator } from '../json-schema-validator.js';
import { ValidationOutput } from '../validation.output.js';
import {
    applyArchitectureOptionsToPattern,
    convertJsonSchemaIssuesToValidationOutputs,
    findLatestCalmCoreSchemaUrl,
    prettifyJson
} from '../validation-helpers.js';
import { emptyRuleResult, RuleResult, ValidationContext, ValidationPhase, ValidationRule } from '../validation-rule.js';

/**
 * Structural (JSON-Schema / AJV) validation. Encapsulates the four historical mode-specific
 * behaviours verbatim so the observable output is unchanged:
 *  - architecture-with-pattern: compile the (option-resolved) pattern and validate the architecture;
 *    a compile failure aborts the remaining phases (controls/node-details).
 *  - architecture-only: discover the latest CALM core schema and validate against it; a compile
 *    failure records an error but does NOT abort subsequent phases.
 *  - pattern-only: compile the pattern to prove it is a valid schema (no instance validation).
 *  - timeline: compile the timeline schema and validate the timeline (compile errors propagate).
 */
export class JsonSchemaValidationRule implements ValidationRule {
    readonly id = 'json-schema';
    readonly description = 'Validate the document against its JSON Schema (pattern / core / timeline)';
    readonly phase = ValidationPhase.STRUCTURAL;

    appliesTo(): boolean {
        return true;
    }

    async run(context: ValidationContext): Promise<RuleResult> {
        const logger = initLogger(context.debug, 'calm-validate');
        switch (context.mode) {
        case 'architecture-with-pattern':
            return this.runArchitectureWithPattern(context, logger);
        case 'architecture-only':
            return this.runArchitectureOnly(context, logger);
        case 'pattern-only':
            return this.runPatternOnly(context);
        case 'timeline':
            return this.runTimeline(context, logger);
        }
    }

    private async runArchitectureWithPattern(context: ValidationContext, logger: Logger): Promise<RuleResult> {
        const architecture = context.architecture!;
        const schemaDirectory = context.schemaDirectory!;
        const patternResolved = applyArchitectureOptionsToPattern(architecture, context.pattern!, context.debug);

        let jsonSchemaValidator: JsonSchemaValidator;
        try {
            jsonSchemaValidator = new JsonSchemaValidator(schemaDirectory, patternResolved, context.debug);
            await jsonSchemaValidator.initialize();
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error(`JSON Schema compilation failed: ${errorMessage}`);
            return {
                jsonSchemaOutputs: [ValidationOutput.error('json-schema', errorMessage, '/', { source: 'pattern' })],
                spectralOutputs: [],
                hasErrors: true,
                hasWarnings: false,
                abort: true
            };
        }

        const schemaErrors = jsonSchemaValidator.validate(architecture);
        if (schemaErrors.length > 0) {
            logger.debug(`JSON Schema validation raw output: ${prettifyJson(schemaErrors)}`);
            return {
                ...emptyRuleResult(),
                jsonSchemaOutputs: convertJsonSchemaIssuesToValidationOutputs(schemaErrors, 'architecture'),
                hasErrors: true
            };
        }
        return emptyRuleResult();
    }

    private async runArchitectureOnly(context: ValidationContext, logger: Logger): Promise<RuleResult> {
        const architecture = context.architecture!;
        const schemaDirectory = context.schemaDirectory;

        const coreSchemaUrl = schemaDirectory ? findLatestCalmCoreSchemaUrl(schemaDirectory) : undefined;
        const coreSchema = (schemaDirectory && coreSchemaUrl) ? await schemaDirectory.getSchema(coreSchemaUrl) : undefined;
        if (!schemaDirectory || !coreSchema) {
            logger.warn('No CALM core schema found in schema directory — skipping JSON schema validation');
            return emptyRuleResult();
        }

        logger.debug(`Validating architecture against CALM core schema: ${coreSchemaUrl}`);
        try {
            const jsonSchemaValidator = new JsonSchemaValidator(schemaDirectory, coreSchema, context.debug);
            await jsonSchemaValidator.initialize();
            const schemaErrors = jsonSchemaValidator.validate(architecture);
            if (schemaErrors.length > 0) {
                logger.debug(`JSON Schema validation raw output: ${prettifyJson(schemaErrors)}`);
                return {
                    ...emptyRuleResult(),
                    jsonSchemaOutputs: convertJsonSchemaIssuesToValidationOutputs(schemaErrors, 'architecture'),
                    hasErrors: true
                };
            }
            return emptyRuleResult();
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            logger.error(`JSON Schema compilation failed: ${errorMessage}`);
            return {
                ...emptyRuleResult(),
                jsonSchemaOutputs: [ValidationOutput.error('json-schema', errorMessage, '/', { source: 'architecture' })],
                hasErrors: true
            };
        }
    }

    private async runPatternOnly(context: ValidationContext): Promise<RuleResult> {
        try {
            // Compile pattern as a schema to check if it's valid
            const jsonSchemaValidator = new JsonSchemaValidator(context.schemaDirectory!, context.pattern!, context.debug);
            await jsonSchemaValidator.initialize();
        } catch (error) {
            return {
                ...emptyRuleResult(),
                jsonSchemaOutputs: [ValidationOutput.error('json-schema', getErrorMessage(error), '/', { source: 'pattern' })],
                hasErrors: true
            };
        }
        return emptyRuleResult();
    }

    private async runTimeline(context: ValidationContext, logger: Logger): Promise<RuleResult> {
        // A compile failure here intentionally propagates (matches the historical timeline flow).
        const jsonSchemaValidator = new JsonSchemaValidator(context.schemaDirectory!, context.pattern!, context.debug);
        await jsonSchemaValidator.initialize();

        const schemaErrors = jsonSchemaValidator.validate(context.timeline!);
        if (schemaErrors.length > 0) {
            logger.debug(`JSON Schema validation raw output: ${prettifyJson(schemaErrors)}`);
            return {
                ...emptyRuleResult(),
                jsonSchemaOutputs: convertJsonSchemaIssuesToValidationOutputs(schemaErrors, 'timeline'),
                hasErrors: true
            };
        }
        return emptyRuleResult();
    }
}

/** Convenience predicate for rules that only run when a SchemaDirectory + architecture exist. */
export function hasArchitectureAndDirectory(context: ValidationContext): context is ValidationContext & { architecture: object, schemaDirectory: SchemaDirectory } {
    return context.architecture !== undefined && context.schemaDirectory !== undefined;
}
