import validationRulesForPattern from '../../spectral/rules-pattern.js';
import validationRulesForArchitecture from '../../spectral/rules-architecture.js';
import validationRulesForTimeline from '../../spectral/rules-timeline.js';
import { ValidationOutcome } from './validation.output.js';
import { ValidationContext, ValidationRule } from './validation-rule.js';
import { stripRefs } from './validation-helpers.js';
import { SpectralValidationRule } from './rules/spectral-rule.js';
import { JsonSchemaValidationRule } from './rules/json-schema-rule.js';
import { ControlsValidationRule } from './rules/controls-rule.js';
import { NodeDetailsValidationRule } from './rules/node-details-rule.js';

/**
 * Runs a set of {@link ValidationRule}s over a {@link ValidationContext} and aggregates their
 * contributions into a single {@link ValidationOutcome}.
 *
 * Rules run in ascending {@link ValidationPhase} order; ties keep registration order (so pattern
 * linting precedes architecture linting). JSON-Schema and Spectral outputs are collected into
 * separate buckets and the error/warning flags are OR-ed — preserving the historical external
 * contract exactly. A rule may set `abort` to short-circuit the remaining rules.
 */
export class ValidationEngine {
    private readonly rules: ValidationRule[];

    constructor(rules: ValidationRule[]) {
        this.rules = rules;
    }

    async validate(context: ValidationContext): Promise<ValidationOutcome> {
        const applicable = this.rules
            .filter(rule => rule.appliesTo(context))
            .sort((a, b) => a.phase - b.phase);

        const jsonSchemaOutputs = [];
        const spectralOutputs = [];
        let hasErrors = false;
        let hasWarnings = false;

        for (const rule of applicable) {
            const result = await rule.run(context);
            jsonSchemaOutputs.push(...result.jsonSchemaOutputs);
            spectralOutputs.push(...result.spectralOutputs);
            hasErrors = hasErrors || result.hasErrors;
            hasWarnings = hasWarnings || result.hasWarnings;
            if (result.abort) {
                break;
            }
        }

        return new ValidationOutcome(jsonSchemaOutputs, spectralOutputs, hasErrors, hasWarnings);
    }
}

/**
 * Build the engine wired with the standard CALM validation rules, in phase order:
 * Spectral (pattern, architecture, timeline) -> JSON-Schema -> Controls -> Node-details.
 */
export function createDefaultValidationEngine(): ValidationEngine {
    return new ValidationEngine([
        new SpectralValidationRule(
            'spectral-pattern',
            'Lint the pattern with the CALM pattern Spectral ruleset',
            validationRulesForPattern,
            'pattern',
            context => (context.pattern ? stripRefs(context.pattern) : undefined),
            context => context.mode === 'architecture-with-pattern' || context.mode === 'pattern-only'
        ),
        new SpectralValidationRule(
            'spectral-architecture',
            'Lint the architecture with the CALM architecture Spectral ruleset',
            validationRulesForArchitecture,
            'architecture',
            context => (context.architecture ? JSON.stringify(context.architecture) : undefined),
            context => context.mode === 'architecture-with-pattern' || context.mode === 'architecture-only'
        ),
        new SpectralValidationRule(
            'spectral-timeline',
            'Lint the timeline with the CALM timeline Spectral ruleset',
            validationRulesForTimeline,
            'timeline',
            context => (context.timeline ? stripRefs(context.timeline) : undefined),
            context => context.mode === 'timeline'
        ),
        new JsonSchemaValidationRule(),
        new ControlsValidationRule(),
        new NodeDetailsValidationRule()
    ]);
}
