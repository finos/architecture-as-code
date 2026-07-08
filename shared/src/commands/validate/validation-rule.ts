import { SchemaDirectory } from '../../schema-directory.js';
import { ValidationOutput } from './validation.output.js';
import { CachingTrackingResolver } from '../../resolver/caching-tracking-resolver.js';
import type { ValidationEngine } from './validation-engine.js';

/**
 * The input combination determines which rules apply. It mirrors the four historical dispatch
 * branches of `validate()`.
 */
export type ValidationMode =
    | 'architecture-with-pattern'
    | 'architecture-only'
    | 'pattern-only'
    | 'timeline';

/**
 * Coarse ordering of validation phases. Rules run in ascending phase order; within a phase,
 * registration order is preserved (so pattern linting precedes architecture linting).
 */
export enum ValidationPhase {
    /** Spectral linting over the raw JSON document(s). */
    LINT = 0,
    /** JSON-Schema (AJV) structural validation. */
    STRUCTURAL = 1,
    /** Semantic checks over the parsed CALM model (e.g. controls). */
    SEMANTIC = 2,
    /** Recursive validation of referenced sub-architectures. */
    RECURSIVE = 3,
}

/**
 * The fragment a single rule contributes to the aggregate {@link ValidationOutcome}. JSON-Schema
 * and Spectral outputs are kept in separate buckets to preserve the external output contract.
 */
export interface RuleResult {
    jsonSchemaOutputs: ValidationOutput[];
    spectralOutputs: ValidationOutput[];
    hasErrors: boolean;
    hasWarnings: boolean;
    /**
     * When true, the engine stops running subsequent rules. Used to reproduce the historical
     * behaviour where a failed pattern compilation short-circuits controls/node-details in the
     * architecture-with-pattern flow.
     */
    abort?: boolean;
}

export function emptyRuleResult(): RuleResult {
    return { jsonSchemaOutputs: [], spectralOutputs: [], hasErrors: false, hasWarnings: false };
}

/**
 * Everything a rule needs to run. A rule reads only what its mode guarantees is present
 * (checked via {@link ValidationRule.appliesTo}).
 */
export interface ValidationContext {
    architecture?: object;
    pattern?: object;
    timeline?: object;
    mode: ValidationMode;
    schemaDirectory?: SchemaDirectory;
    /**
     * Shared caching/tracking resolver threaded through recursive node-details validation. It
     * caches each loaded sub-architecture and records which references have been visited, providing
     * both dedupe ("validate each sub-architecture once") and cycle safety.
     */
    references: CachingTrackingResolver;
    debug: boolean;
    /** The engine, so recursive rules can re-enter the pipeline for sub-architectures. */
    engine: ValidationEngine;
}

/**
 * A single, self-contained unit of validation. Two families exist: Spectral-backed rules that
 * lint the raw JSON, and model-backed rules that reason over the parsed CALM model.
 */
export interface ValidationRule {
    readonly id: string;
    readonly description: string;
    readonly phase: ValidationPhase;
    /** Whether this rule should run for the given context (typically a mode/input check). */
    appliesTo(context: ValidationContext): boolean;
    run(context: ValidationContext): Promise<RuleResult>;
}
