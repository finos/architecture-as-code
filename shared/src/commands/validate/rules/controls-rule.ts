import { validateAllControls } from '../validate-controls.js';
import { RuleResult, ValidationContext, ValidationPhase, ValidationRule } from '../validation-rule.js';
import { hasArchitectureAndDirectory } from './json-schema-rule.js';

/**
 * A model-backed {@link ValidationRule}: validates every control config against its requirement
 * schema. This is the "custom-on-model" side of the two-implementation design — it reasons over
 * the parsed CALM model rather than JSONPath. Only runs when a SchemaDirectory is available.
 */
export class ControlsValidationRule implements ValidationRule {
    readonly id = 'controls';
    readonly description = 'Validate control configurations against their requirement schemas';
    readonly phase = ValidationPhase.SEMANTIC;

    appliesTo(context: ValidationContext): boolean {
        return hasArchitectureAndDirectory(context);
    }

    async run(context: ValidationContext): Promise<RuleResult> {
        const result = await validateAllControls(context.architecture!, context.pattern, context.schemaDirectory!, context.debug);
        return {
            jsonSchemaOutputs: result.jsonSchemaOutputs,
            spectralOutputs: [],
            hasErrors: result.hasErrors,
            hasWarnings: result.hasWarnings
        };
    }
}
