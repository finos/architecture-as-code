import { RulesetDefinition } from '@stoplight/spectral-core';
import { initLogger } from '../../../logger.js';
import { runSpectralValidations } from '../validation-helpers.js';
import { RuleResult, ValidationContext, ValidationPhase, ValidationRule } from '../validation-rule.js';

/**
 * Selects and serialises the document a Spectral rule should lint from the context.
 * Returns undefined when the required document is absent (rule then contributes nothing).
 */
export type DocumentSelector = (context: ValidationContext) => string | undefined;

/**
 * A {@link ValidationRule} backed by a Spectral ruleset. This is the "Spectral implementation" of
 * the two-implementation design: declarative JSONPath rules over the raw JSON document.
 */
export class SpectralValidationRule implements ValidationRule {
    readonly phase = ValidationPhase.LINT;

    constructor(
        readonly id: string,
        readonly description: string,
        private readonly ruleset: RulesetDefinition,
        private readonly source: string,
        private readonly selectDocument: DocumentSelector,
        private readonly applies: (context: ValidationContext) => boolean
    ) {}

    appliesTo(context: ValidationContext): boolean {
        return this.applies(context) && this.selectDocument(context) !== undefined;
    }

    async run(context: ValidationContext): Promise<RuleResult> {
        const logger = initLogger(context.debug, 'calm-validate');
        const document = this.selectDocument(context)!;
        const result = await runSpectralValidations(document, this.ruleset, this.source, logger);
        return {
            jsonSchemaOutputs: [],
            spectralOutputs: result.spectralIssues,
            hasErrors: result.errors,
            hasWarnings: result.warnings
        };
    }
}
