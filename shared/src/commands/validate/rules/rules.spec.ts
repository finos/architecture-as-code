import validationRulesForArchitecture from '../../../spectral/rules-architecture';
import { SpectralValidationRule } from './spectral-rule';
import { ControlsValidationRule } from './controls-rule';
import { NodeDetailsValidationRule } from './node-details-rule';
import { JsonSchemaValidationRule } from './json-schema-rule';
import { ValidationContext, ValidationMode } from '../validation-rule';
import { SchemaDirectory } from '../../../schema-directory';
import { ValidationEngine } from '../validation-engine';
import { validateAllControls } from '../validate-controls';
import { validateNodeDetails } from '../validate-node-details';
import { JsonSchemaValidator } from '../json-schema-validator';
import { CachingTrackingResolver } from '../../../resolver/caching-tracking-resolver';

vi.mock('../../../logger.js', () => ({
    initLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));
vi.mock('../validate-controls.js', () => ({ validateAllControls: vi.fn() }));
vi.mock('../validate-node-details.js', () => ({ validateNodeDetails: vi.fn() }));
vi.mock('../json-schema-validator.js', () => ({ JsonSchemaValidator: vi.fn() }));

const fakeDir = {} as unknown as SchemaDirectory;

function ctx(overrides: Partial<ValidationContext>): ValidationContext {
    return {
        mode: 'architecture-only',
        references: new CachingTrackingResolver({ canResolve: () => false, resolve: () => Promise.reject(new Error('unused')) }),
        debug: false,
        engine: undefined as unknown as ValidationEngine,
        ...overrides
    };
}

describe('SpectralValidationRule.appliesTo', () => {
    const patternRule = new SpectralValidationRule(
        'spectral-pattern', 'pattern', validationRulesForArchitecture, 'pattern',
        c => (c.pattern ? JSON.stringify(c.pattern) : undefined),
        c => c.mode === 'architecture-with-pattern' || c.mode === 'pattern-only'
    );

    it('applies only when mode allows AND the selected document is present', () => {
        expect(patternRule.appliesTo(ctx({ mode: 'pattern-only', pattern: {} }))).toBe(true);
        expect(patternRule.appliesTo(ctx({ mode: 'architecture-with-pattern', pattern: {} }))).toBe(true);
    });

    it('does not apply when the mode is excluded', () => {
        expect(patternRule.appliesTo(ctx({ mode: 'architecture-only', pattern: {} }))).toBe(false);
        expect(patternRule.appliesTo(ctx({ mode: 'timeline', pattern: {} }))).toBe(false);
    });

    it('does not apply when the selected document is absent', () => {
        expect(patternRule.appliesTo(ctx({ mode: 'pattern-only', pattern: undefined }))).toBe(false);
    });
});

describe('ControlsValidationRule', () => {
    const rule = new ControlsValidationRule();

    it('applies only when architecture AND schemaDirectory are present', () => {
        expect(rule.appliesTo(ctx({ architecture: {}, schemaDirectory: fakeDir }))).toBe(true);
        expect(rule.appliesTo(ctx({ architecture: {} }))).toBe(false);
        expect(rule.appliesTo(ctx({ schemaDirectory: fakeDir }))).toBe(false);
    });

    it('delegates to validateAllControls and maps the result', async () => {
        vi.mocked(validateAllControls).mockResolvedValue({
            jsonSchemaOutputs: [{ code: 'c' } as never],
            hasErrors: true,
            hasWarnings: false
        });

        const result = await rule.run(ctx({ architecture: { a: 1 }, pattern: { p: 1 }, schemaDirectory: fakeDir }));

        expect(validateAllControls).toHaveBeenCalledWith({ a: 1 }, { p: 1 }, fakeDir, false);
        expect(result.jsonSchemaOutputs).toEqual([{ code: 'c' }]);
        expect(result.spectralOutputs).toEqual([]);
        expect(result.hasErrors).toBe(true);
    });
});

describe('NodeDetailsValidationRule', () => {
    const rule = new NodeDetailsValidationRule();

    it('applies only when architecture AND schemaDirectory are present', () => {
        expect(rule.appliesTo(ctx({ architecture: {}, schemaDirectory: fakeDir }))).toBe(true);
        expect(rule.appliesTo(ctx({ architecture: {} }))).toBe(false);
    });

    it('delegates to validateNodeDetails, threading the shared visited set', async () => {
        vi.mocked(validateNodeDetails).mockResolvedValue({
            jsonSchemaOutputs: [{ code: 'n' } as never],
            spectralOutputs: [{ code: 's' } as never],
            hasErrors: false,
            hasWarnings: true
        });
        const references = new CachingTrackingResolver({ canResolve: () => false, resolve: () => Promise.reject(new Error('unused')) });
        references.markSeen('seen');

        const result = await rule.run(ctx({ architecture: { a: 1 }, schemaDirectory: fakeDir, references }));

        expect(validateNodeDetails).toHaveBeenCalledWith({ a: 1 }, fakeDir, false, expect.any(Function), references);
        expect(result.jsonSchemaOutputs).toEqual([{ code: 'n' }]);
        expect(result.spectralOutputs).toEqual([{ code: 's' }]);
        expect(result.hasWarnings).toBe(true);
    });
});

describe('JsonSchemaValidationRule compile-failure short-circuit', () => {
    const rule = new JsonSchemaValidationRule();

    beforeEach(() => {
        vi.mocked(JsonSchemaValidator).mockImplementation(() => ({
            initialize: vi.fn().mockRejectedValue(new Error('bad schema')),
            validate: vi.fn().mockReturnValue([])
        }) as unknown as JsonSchemaValidator);
    });

    it('aborts subsequent phases when the pattern fails to compile (architecture-with-pattern)', async () => {
        const result = await rule.run(ctx({ mode: 'architecture-with-pattern' as ValidationMode, architecture: {}, pattern: {}, schemaDirectory: fakeDir }));

        expect(result.abort).toBe(true);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].source).toBe('pattern');
    });

    it('does NOT abort when the core schema fails to compile (architecture-only)', async () => {
        const dir = { getLoadedSchemas: () => ['https://calm.finos.org/release/1.2/meta/core.json'], getSchema: vi.fn().mockResolvedValue({ type: 'object' }) } as unknown as SchemaDirectory;

        const result = await rule.run(ctx({ mode: 'architecture-only' as ValidationMode, architecture: {}, schemaDirectory: dir }));

        expect(result.abort).toBeUndefined();
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].source).toBe('architecture');
    });
});
