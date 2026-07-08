import { ValidationEngine } from './validation-engine';
import { RuleResult, ValidationContext, ValidationPhase, ValidationRule } from './validation-rule';
import { CachingTrackingResolver } from '../../resolver/caching-tracking-resolver';

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
    return {
        mode: 'architecture-only',
        references: new CachingTrackingResolver({ canResolve: () => false, resolve: () => Promise.reject(new Error('unused')) }),
        debug: false,
        // engine is only used by recursive rules; fake rules here don't touch it.
        engine: undefined as unknown as ValidationEngine,
        ...overrides
    };
}

function fakeRule(
    id: string,
    phase: ValidationPhase,
    result: Partial<RuleResult>,
    opts: { applies?: boolean, calls?: string[] } = {}
): ValidationRule {
    return {
        id,
        description: id,
        phase,
        appliesTo: () => opts.applies ?? true,
        run: async () => {
            opts.calls?.push(id);
            return {
                jsonSchemaOutputs: [],
                spectralOutputs: [],
                hasErrors: false,
                hasWarnings: false,
                ...result
            };
        }
    };
}

function output(code: string) {
    return { code, severity: 'error', message: code, path: '/', schemaPath: undefined } as never;
}

describe('ValidationEngine', () => {
    it('aggregates json-schema and spectral outputs into separate buckets', async () => {
        const engine = new ValidationEngine([
            fakeRule('a', ValidationPhase.LINT, { spectralOutputs: [output('spec-a')] }),
            fakeRule('b', ValidationPhase.STRUCTURAL, { jsonSchemaOutputs: [output('json-b')] })
        ]);

        const outcome = await engine.validate(ctx());

        expect(outcome.spectralSchemaValidationOutputs.map(o => o.code)).toEqual(['spec-a']);
        expect(outcome.jsonSchemaValidationOutputs.map(o => o.code)).toEqual(['json-b']);
    });

    it('runs rules in ascending phase order regardless of registration order', async () => {
        const calls: string[] = [];
        const engine = new ValidationEngine([
            fakeRule('recursive', ValidationPhase.RECURSIVE, {}, { calls }),
            fakeRule('lint', ValidationPhase.LINT, {}, { calls }),
            fakeRule('semantic', ValidationPhase.SEMANTIC, {}, { calls }),
            fakeRule('structural', ValidationPhase.STRUCTURAL, {}, { calls })
        ]);

        await engine.validate(ctx());

        expect(calls).toEqual(['lint', 'structural', 'semantic', 'recursive']);
    });

    it('preserves registration order for rules within the same phase', async () => {
        const calls: string[] = [];
        const engine = new ValidationEngine([
            fakeRule('pattern', ValidationPhase.LINT, {}, { calls }),
            fakeRule('architecture', ValidationPhase.LINT, {}, { calls })
        ]);

        await engine.validate(ctx());

        expect(calls).toEqual(['pattern', 'architecture']);
    });

    it('skips rules that do not apply', async () => {
        const calls: string[] = [];
        const engine = new ValidationEngine([
            fakeRule('applies', ValidationPhase.LINT, {}, { calls, applies: true }),
            fakeRule('skipped', ValidationPhase.STRUCTURAL, {}, { calls, applies: false })
        ]);

        await engine.validate(ctx());

        expect(calls).toEqual(['applies']);
    });

    it('ORs the error and warning flags across rules', async () => {
        const engine = new ValidationEngine([
            fakeRule('warn', ValidationPhase.LINT, { hasWarnings: true }),
            fakeRule('err', ValidationPhase.STRUCTURAL, { hasErrors: true })
        ]);

        const outcome = await engine.validate(ctx());

        expect(outcome.hasErrors).toBe(true);
        expect(outcome.hasWarnings).toBe(true);
    });

    it('short-circuits remaining rules when a rule aborts', async () => {
        const calls: string[] = [];
        const engine = new ValidationEngine([
            fakeRule('structural', ValidationPhase.STRUCTURAL, { jsonSchemaOutputs: [output('json')], hasErrors: true, abort: true }, { calls }),
            fakeRule('semantic', ValidationPhase.SEMANTIC, { jsonSchemaOutputs: [output('should-not-run')] }, { calls })
        ]);

        const outcome = await engine.validate(ctx());

        expect(calls).toEqual(['structural']);
        expect(outcome.jsonSchemaValidationOutputs.map(o => o.code)).toEqual(['json']);
        expect(outcome.hasErrors).toBe(true);
    });

    it('returns an empty passing outcome when no rules apply', async () => {
        const engine = new ValidationEngine([
            fakeRule('skipped', ValidationPhase.LINT, {}, { applies: false })
        ]);

        const outcome = await engine.validate(ctx());

        expect(outcome.jsonSchemaValidationOutputs).toEqual([]);
        expect(outcome.spectralSchemaValidationOutputs).toEqual([]);
        expect(outcome.hasErrors).toBe(false);
        expect(outcome.hasWarnings).toBe(false);
    });
});
