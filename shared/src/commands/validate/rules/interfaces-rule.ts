import { validateAllInterfaces } from '../validate-interfaces.js';
import { RuleResult, ValidationContext, ValidationPhase, ValidationRule } from '../validation-rule.js';
import { hasArchitectureAndDirectory } from './json-schema-rule.js';

/**
 * A model-backed {@link ValidationRule}: validates every node interface definition's config
 * against the schema at its definition-url. Only runs when a SchemaDirectory is available.
 */
export class InterfacesValidationRule implements ValidationRule {
    readonly id = 'interfaces';
    readonly description = 'Validate interface configurations against their interface definitions';
    readonly phase = ValidationPhase.SEMANTIC;

    appliesTo(context: ValidationContext): boolean {
        return hasArchitectureAndDirectory(context);
    }

    async run(context: ValidationContext): Promise<RuleResult> {
        const result = await validateAllInterfaces(context.architecture!, context.schemaDirectory!, context.debug);
        return {
            jsonSchemaOutputs: result.jsonSchemaOutputs,
            spectralOutputs: [],
            hasErrors: result.hasErrors,
            hasWarnings: result.hasWarnings
        };
    }
}
