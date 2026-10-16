import { describe, it, expect } from 'vitest';
import { BEGINNER_02 } from './lesson';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const seedDoc = JSON.parse(BEGINNER_02.seedFiles[BEGINNER_02.editorFile]);

const nodeWith = (id: string) => ({ 'unique-id': id, 'node-type': 'service', name: 'X', description: 'y' });

const withNode = { ...seedDoc, nodes: [nodeWith('payment-service')] };
const withDifferentName = { ...seedDoc, nodes: [nodeWith('auth-service')] };
const withIncompleteNode = {
    ...seedDoc,
    nodes: [{ 'unique-id': 'payment-service', 'node-type': 'service', name: 'Payment Service' }],
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
    editorFile: BEGINNER_02.editorFile,
    files: {},
    ...over,
});

describe('beginner-02 lesson', () => {
    const [look, addNode, validate] = BEGINNER_02.steps;

    it('has three steps with unique ids', () => {
        expect(BEGINNER_02.steps.map((step) => step.id)).toHaveLength(3);
        expect(new Set(BEGINNER_02.steps.map((step) => step.id)).size).toBe(3);
    });

    it('step 1 completes on a successful validate of the lesson file', () => {
        expect(look.check(state({}))).toBe(false);
        expect(look.check(state({ commands: [validateOutcome(BEGINNER_02.editorFile, true)] }))).toBe(true);
        // A validate of a different file does not complete this step.
        expect(look.check(state({ commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
    });

    it('step 2 needs a complete node AND a valid document', () => {
        expect(addNode.check(state({ doc: seedDoc, validation: { ok: true } }))).toBe(false);
        expect(addNode.check(state({ doc: withNode, validation: { ok: true } }))).toBe(true);
        // A different unique-id from the hint still passes: the check matches shape, not names.
        expect(addNode.check(state({ doc: withDifferentName, validation: { ok: true } }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(addNode.check(state({ doc: withNode, validation: { ok: false } }))).toBe(false);
        // Missing a required property: must not tick.
        expect(addNode.check(state({ doc: withIncompleteNode, validation: { ok: true } }))).toBe(false);
    });

    it('step 3 needs a complete node AND a fresh validate of the lesson file', () => {
        expect(validate.check(state({ doc: withNode, commands: [] }))).toBe(false);
        expect(validate.check(state({ doc: withNode, commands: [validateOutcome(BEGINNER_02.editorFile, true)] }))).toBe(true);
        // A different unique-id from the hint still passes.
        expect(validate.check(state({ doc: withDifferentName, commands: [validateOutcome(BEGINNER_02.editorFile, true)] }))).toBe(true);
        // A stale/other-file validate does not count.
        expect(validate.check(state({ doc: withNode, commands: [validateOutcome('/workspace/other.json', true)] }))).toBe(false);
        // No complete node yet: must not tick even with a fresh validate.
        expect(validate.check(state({ doc: seedDoc, commands: [validateOutcome(BEGINNER_02.editorFile, true)] }))).toBe(false);
    });
});
