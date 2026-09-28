import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_08 } from './lesson';
import { BEGINNER_07 } from '../beginner-07/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
    'unique-id': id, 'node-type': type, name: id, description: 'y', ...extra,
});
const doc = (nodes: unknown[], controls?: Record<string, unknown>) => ({
    $schema: SCHEMA,
    ...(controls ? { controls } : {}),
    nodes,
    relationships: [],
});

const securityControl = {
    description: 'Data encryption requirements',
    requirements: [{ 'requirement-url': 'https://policy.example.com/encryption', config: { algorithm: 'AES-256' } }],
};
const auditControl = {
    description: 'Independent audit requirements',
    requirements: [{ 'requirement-url': 'https://policy.example.com/audit', 'config-url': 'https://configs.example.com/audit.yaml' }],
};
const emptyRequirementsControl = { description: 'Nothing configured yet', requirements: [] };

const baseNodes = [node('checkout-service', 'service'), node('checkout-db', 'database')];

// Step 1: a top-level security control.
const architectureSecurity = doc(baseNodes, { security: securityControl });
// A control with an empty requirements array: must not tick.
const emptyRequirements = doc(baseNodes, { security: emptyRequirementsControl });

// Step 2: a second top-level domain.
const architecturePerformance = doc(baseNodes, { security: securityControl, 'data-residency': auditControl });

// Step 3: a control on a service node, any domain.
const complianceNodes = [node('checkout-service', 'service', { controls: { compliance: securityControl } }), node('checkout-db', 'database')];
const nodeCompliance = doc(complianceNodes, { security: securityControl, 'data-residency': auditControl });
// The control lands on a database instead of a service: must not tick.
const complianceOnDatabase = doc(
    [node('checkout-service', 'service'), node('checkout-db', 'database', { controls: { compliance: securityControl } })],
    { security: securityControl, 'data-residency': auditControl },
);

// Step 4: a second node-level domain, on a service or database, different from step 3's domain.
const nodePerformanceNodes = [
    node('checkout-service', 'service', { controls: { compliance: securityControl } }),
    node('checkout-db', 'database', { controls: { operational: auditControl } }),
];
const nodePerformance = doc(nodePerformanceNodes, { security: securityControl, 'data-residency': auditControl });
// A second control, but still in the same domain as step 3 (on a different node): must not tick.
const secondComplianceOnly = doc(
    [
        node('checkout-service', 'service', { controls: { compliance: securityControl } }),
        node('checkout-db', 'database', { controls: { compliance: auditControl } }),
    ],
    { security: securityControl, 'data-residency': auditControl },
);

const validateOutcome = (architecture: string, ok: boolean): CommandOutcome => ({
    command: 'validate',
    files: { architecture },
    ok,
    errorCount: ok ? 0 : 1,
    warningCount: 0,
    snapshot: {},
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: INTERMEDIATE_08.editorFile,
    files: {},
    ...over,
});

describe('intermediate-08 lesson', () => {
    const [security, performance, nodeComplianceStep, nodePerformanceStep, validate] = INTERMEDIATE_08.steps;

    it('has five steps with unique ids', () => {
        expect(INTERMEDIATE_08.steps).toHaveLength(5);
        expect(new Set(INTERMEDIATE_08.steps.map((step) => step.id)).size).toBe(5);
    });

    it('chains from beginner-07 and keeps the same editor file', () => {
        expect(INTERMEDIATE_08.chainsFrom).toBe('beginner-07');
        expect(INTERMEDIATE_08.editorFile).toBe(BEGINNER_07.editorFile);
        expect(INTERMEDIATE_08.seedFiles).toEqual(endFiles(BEGINNER_07));
    });

    it('every file hint is complete, valid JSON', () => {
        for (const step of INTERMEDIATE_08.steps) {
            const hint = step.hint;
            if (hint.kind === 'file') {
                expect(() => JSON.parse(hint.content), step.id).not.toThrow();
            }
        }
    });

    it('architecture-security needs a top-level security control with configured requirements, in a valid document', () => {
        expect(security.check(state({ doc: doc(baseNodes) }))).toBe(false);
        // Different names from the hint: still passes.
        expect(security.check(state({ doc: architectureSecurity }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(security.check(state({ doc: architectureSecurity, validation: { ok: false } }))).toBe(false);
        // Empty requirements array: must not tick.
        expect(security.check(state({ doc: emptyRequirements }))).toBe(false);
    });

    it('architecture-performance needs a second top-level domain, in a valid document', () => {
        expect(performance.check(state({ doc: architectureSecurity }))).toBe(false);
        // Different names from the hint: still passes.
        expect(performance.check(state({ doc: architecturePerformance }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(performance.check(state({ doc: architecturePerformance, validation: { ok: false } }))).toBe(false);
    });

    it('node-compliance needs a control on a service node, in a valid document', () => {
        expect(nodeComplianceStep.check(state({ doc: architecturePerformance }))).toBe(false);
        // Different names from the hint: still passes.
        expect(nodeComplianceStep.check(state({ doc: nodeCompliance }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(nodeComplianceStep.check(state({ doc: nodeCompliance, validation: { ok: false } }))).toBe(false);
        // On a database instead of a service: must not tick.
        expect(nodeComplianceStep.check(state({ doc: complianceOnDatabase }))).toBe(false);
    });

    it('node-performance needs a second node-level domain on a service or database, in a valid document', () => {
        expect(nodePerformanceStep.check(state({ doc: nodeCompliance }))).toBe(false);
        // Different names from the hint: still passes.
        expect(nodePerformanceStep.check(state({ doc: nodePerformance }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(nodePerformanceStep.check(state({ doc: nodePerformance, validation: { ok: false } }))).toBe(false);
        // A second control, but still in the same domain as step 3: must not tick.
        expect(nodePerformanceStep.check(state({ doc: secondComplianceOnly }))).toBe(false);
    });

    it('validate needs every control in place AND a fresh validate of the editor file', () => {
        const editorValidate = validateOutcome(INTERMEDIATE_08.editorFile, true);
        expect(validate.check(state({ doc: nodePerformance }))).toBe(false);
        expect(validate.check(state({ doc: nodePerformance, commands: [editorValidate] }))).toBe(true);
        expect(validate.check(state({ doc: nodePerformance, commands: [validateOutcome(INTERMEDIATE_08.editorFile, false)] }))).toBe(false);
        expect(validate.check(state({ doc: nodeCompliance, commands: [editorValidate] }))).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_08);
        for (const step of INTERMEDIATE_08.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('links to the next lesson', () => {
        expect(INTERMEDIATE_08.completion.links).toEqual([
            { to: '?lesson=intermediate-09', label: 'Next lesson: Business flows' },
        ]);
    });
});
