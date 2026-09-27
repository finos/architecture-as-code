import { describe, it, expect } from 'vitest';
import { QUICK_START, hasOrdersApiNode, hasConnectsRelationship } from './lesson';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const seedDoc = JSON.parse(QUICK_START.seedFiles[QUICK_START.editorFile]);
const withOrders = {
    ...seedDoc,
    nodes: [
        ...seedDoc.nodes,
        { 'unique-id': 'orders-api', 'node-type': 'service', name: 'Orders API', description: 'x' },
    ],
};
const withRelationship = {
    ...withOrders,
    relationships: [
        {
            'unique-id': 'ui-to-orders',
            'relationship-type': {
                connects: { source: { node: 'trading-ui' }, destination: { node: 'orders-api' } },
            },
        },
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
    editorFile: QUICK_START.editorFile,
    ...over,
});

describe('quick-start lesson', () => {
    const [look, add, connect] = QUICK_START.steps;

    it('has three steps with unique ids', () => {
        expect(QUICK_START.steps.map((step) => step.id)).toHaveLength(3);
        expect(new Set(QUICK_START.steps.map((step) => step.id)).size).toBe(3);
    });

    it('step 1 completes on a successful validate of the lesson file', () => {
        expect(look.check(state({}))).toBe(false);
        expect(look.check(state({ commands: [validateOutcome(QUICK_START.editorFile, true)] }))).toBe(true);
        // A validate of a different file does not complete this step.
        expect(look.check(state({ commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
    });

    it('step 2 needs the orders-api node AND a valid document', () => {
        expect(hasOrdersApiNode(seedDoc)).toBe(false);
        expect(hasOrdersApiNode(withOrders)).toBe(true);
        expect(add.check(state({ doc: withOrders, validation: { ok: false } }))).toBe(false);
        expect(add.check(state({ doc: withOrders, validation: { ok: true } }))).toBe(true);
    });

    it('step 3 needs a connects relationship AND a valid document', () => {
        expect(hasConnectsRelationship(withOrders)).toBe(false);
        expect(hasConnectsRelationship(withRelationship)).toBe(true);
        const reversed = {
            ...withOrders,
            relationships: [{
                'unique-id': 'ui-to-orders',
                'relationship-type': { connects: { source: { node: 'orders-api' }, destination: { node: 'trading-ui' } } },
            }],
        };
        expect(hasConnectsRelationship(reversed)).toBe(false);
        expect(connect.check(state({ doc: withRelationship, validation: { ok: false } }))).toBe(false);
        expect(connect.check(state({ doc: withRelationship, validation: { ok: true } }))).toBe(true);
    });

    it('links only to the next lesson', () => {
        expect(QUICK_START.completion.links).toEqual([
            { to: '?lesson=beginner-02', label: 'Next lesson: Create your first node' },
        ]);
    });
});
