import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_09 } from './lesson';
import { INTERMEDIATE_08 } from '../intermediate-08/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const relationship = (id: string, kind: string, detail: Record<string, unknown>) => ({
    'unique-id': id, 'relationship-type': { [kind]: detail },
});
const baseRelationships = [
    relationship('customer-to-gateway', 'interacts', { actor: 'customer', nodes: ['api-gateway'] }),
    relationship('gateway-to-orders', 'connects', { source: { node: 'api-gateway' }, destination: { node: 'order-service' } }),
    relationship('orders-to-payment', 'connects', { source: { node: 'order-service' }, destination: { node: 'payment-service' } }),
    relationship('gateway-to-inventory', 'connects', { source: { node: 'api-gateway' }, destination: { node: 'inventory-service' } }),
];
const doc = (flows?: unknown[]) => ({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [],
    relationships: baseRelationships,
    ...(flows ? { flows } : {}),
});

const transition = (relationshipId: string, sequence: number, direction?: string) => ({
    'relationship-unique-id': relationshipId,
    'sequence-number': sequence,
    description: 'a step',
    ...(direction ? { direction } : {}),
});

// Step 1: a flow with at least three transitions, all resolving to real relationships.
const orderFlow = {
    'unique-id': 'checkout-flow',
    name: 'Checkout',
    description: 'Order to payment',
    transitions: [
        transition('customer-to-gateway', 1),
        transition('gateway-to-orders', 2),
        transition('orders-to-payment', 3),
    ],
};
// A transition names a relationship id that does not exist: must not tick, even though the
// engine's flow.json schema does not check that a relationship-unique-id resolves.
const orderFlowWithDanglingTransition = {
    ...orderFlow,
    transitions: [
        transition('customer-to-gateway', 1),
        transition('gateway-to-orders', 2),
        transition('does-not-exist', 3),
    ],
};
// Only two transitions: not enough for the order flow step.
const shortFlow = { ...orderFlow, transitions: orderFlow.transitions.slice(0, 2) };

// Step 3: a second flow with at least two transitions, one reusing a relationship in reverse.
const stockFlow = {
    'unique-id': 'stock-check',
    name: 'Stock check',
    description: 'Check inventory levels',
    transitions: [
        transition('gateway-to-inventory', 1),
        transition('gateway-to-inventory', 2, 'destination-to-source'),
    ],
};

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
    editorFile: INTERMEDIATE_09.editorFile,
    files: {},
    ...over,
});

describe('intermediate-09 lesson', () => {
    const [orderFlowStep, validateOrderFlow, stockFlowStep, validate] = INTERMEDIATE_09.steps;

    it('has four steps with unique ids', () => {
        expect(INTERMEDIATE_09.steps).toHaveLength(4);
        expect(new Set(INTERMEDIATE_09.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from intermediate-08 and keeps the same editor file', () => {
        expect(INTERMEDIATE_09.chainsFrom).toBe('intermediate-08');
        expect(INTERMEDIATE_09.editorFile).toBe(INTERMEDIATE_08.editorFile);
        expect(INTERMEDIATE_09.seedFiles).toEqual(endFiles(INTERMEDIATE_08));
    });

    it('every file hint is complete, valid JSON', () => {
        for (const step of INTERMEDIATE_09.steps) {
            const hint = step.hint;
            if (hint.kind === 'file') {
                expect(() => JSON.parse(hint.content), step.id).not.toThrow();
            }
        }
    });

    it('order-flow needs a flow with at least three resolving transitions, in a valid document', () => {
        expect(orderFlowStep.check(state({ doc: doc() }))).toBe(false);
        // Different names from the hint: still passes.
        expect(orderFlowStep.check(state({ doc: doc([orderFlow]) }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(orderFlowStep.check(state({ doc: doc([orderFlow]), validation: { ok: false } }))).toBe(false);
        // A transition naming a relationship that does not exist: must not tick.
        expect(orderFlowStep.check(state({ doc: doc([orderFlowWithDanglingTransition]) }))).toBe(false);
        // Too few transitions: must not tick.
        expect(orderFlowStep.check(state({ doc: doc([shortFlow]) }))).toBe(false);
    });

    it('validate-order-flow needs the order flow AND a fresh validate of the editor file', () => {
        const editorValidate = validateOutcome(INTERMEDIATE_09.editorFile, true);
        expect(validateOrderFlow.check(state({ doc: doc([orderFlow]) }))).toBe(false);
        expect(validateOrderFlow.check(state({ doc: doc([orderFlow]), commands: [editorValidate] }))).toBe(true);
        expect(validateOrderFlow.check(state({ doc: doc([orderFlow]), commands: [validateOutcome(INTERMEDIATE_09.editorFile, false)] }))).toBe(false);
        expect(validateOrderFlow.check(state({ doc: doc(), commands: [editorValidate] }))).toBe(false);
    });

    it('stock-flow needs a second flow, in a valid document', () => {
        expect(stockFlowStep.check(state({ doc: doc([orderFlow]) }))).toBe(false);
        // Different names from the hint: still passes.
        expect(stockFlowStep.check(state({ doc: doc([orderFlow, stockFlow]) }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(stockFlowStep.check(state({ doc: doc([orderFlow, stockFlow]), validation: { ok: false } }))).toBe(false);
        // A second flow with enough transitions, but one names a relationship that does not exist: must not tick.
        const stockFlowDangling = {
            ...stockFlow,
            transitions: [transition('gateway-to-inventory', 1), transition('does-not-exist', 2)],
        };
        expect(stockFlowStep.check(state({ doc: doc([orderFlow, stockFlowDangling]) }))).toBe(false);
        // The first flow twice: must not tick.
        expect(stockFlowStep.check(state({ doc: doc([orderFlow, { ...orderFlow }]) }))).toBe(false);
    });

    it('validate needs both flows AND a fresh validate of the editor file', () => {
        const editorValidate = validateOutcome(INTERMEDIATE_09.editorFile, true);
        expect(validate.check(state({ doc: doc([orderFlow, stockFlow]) }))).toBe(false);
        expect(validate.check(state({ doc: doc([orderFlow, stockFlow]), commands: [editorValidate] }))).toBe(true);
        expect(validate.check(state({ doc: doc([orderFlow, stockFlow]), commands: [validateOutcome(INTERMEDIATE_09.editorFile, false)] }))).toBe(false);
        // A fresh validate, but the document has only the order flow: must not tick.
        expect(validate.check(state({ doc: doc([orderFlow]), commands: [editorValidate] }))).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_09);
        for (const step of INTERMEDIATE_09.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('has no completion links yet', () => {
        expect(INTERMEDIATE_09.completion.links).toContainEqual({
            to: '?lesson=intermediate-10',
            label: 'Next lesson: Link architecture decision records',
        });
    });
});
