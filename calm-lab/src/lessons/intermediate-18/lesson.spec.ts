import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_18, NODE_STD, RELATIONSHIP_STD } from './lesson';
import { INTERMEDIATE_17 } from '../intermediate-17/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { LessonState } from '../types';

const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
const RELATIONSHIP_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship';

/** A standard whose `allOf` $refs `ref` and requires `required` in the second `allOf` entry. */
const standard = (ref: string, required: string[]) => JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.com/standards/mine.json',
    title: 'Mine',
    allOf: [{ $ref: ref }, { type: 'object', required }],
});

/** A standard whose `required` sits at the top level, sibling to `allOf`, instead of inside it. */
const topLevelStandard = (ref: string, required: string[]) => JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.com/standards/mine.json',
    title: 'Mine',
    allOf: [{ $ref: ref }],
    required,
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: INTERMEDIATE_18.editorFile,
    files: {},
    ...over,
});

describe('intermediate-18 lesson', () => {
    const [nodeStandard, relationshipStandard] = INTERMEDIATE_18.steps;

    it('has two steps with unique ids', () => {
        expect(INTERMEDIATE_18.steps).toHaveLength(2);
        expect(new Set(INTERMEDIATE_18.steps.map((step) => step.id)).size).toBe(2);
    });

    it('chains from intermediate-17, keeps its editor file, and seeds both standard stubs', () => {
        expect(INTERMEDIATE_18.chainsFrom).toBe('intermediate-17');
        expect(INTERMEDIATE_18.editorFile).toBe(INTERMEDIATE_17.editorFile);
        for (const [path, content] of Object.entries(endFiles(INTERMEDIATE_17))) {
            expect(INTERMEDIATE_18.seedFiles[path]).toBe(content);
        }
        for (const path of [NODE_STD, RELATIONSHIP_STD]) {
            expect(INTERMEDIATE_18.seedFiles[path], path).toBeTypeOf('string');
        }
    });

    it('node-standard needs a required property added on top of the core node definition', () => {
        // No allOf at all: the stub.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: INTERMEDIATE_18.seedFiles[NODE_STD] } }))).toBe(false);
        // Different property name from the hint: still passes.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: standard(NODE_REF, ['ownerTeamId']) } }))).toBe(true);
        // Different shape: required at the top level, sibling to allOf, instead of inside it.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: topLevelStandard(NODE_REF, ['costCenter', 'owner']) } }))).toBe(true);
        // allOf present but $refs the wrong core definition.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: standard(RELATIONSHIP_REF, ['costCenter']) } }))).toBe(false);
        // Correct $ref but nothing required.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: standard(NODE_REF, []) } }))).toBe(false);
        // A half-edited file: must not tick, must not throw.
        expect(nodeStandard.check(state({ files: { [NODE_STD]: standard(NODE_REF, ['costCenter']).slice(0, 30) } }))).toBe(false);
    });

    it('relationship-standard needs a required property added on top of the core relationship definition', () => {
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: INTERMEDIATE_18.seedFiles[RELATIONSHIP_STD] } }))).toBe(false);
        // Different property name from the hint: still passes.
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: standard(RELATIONSHIP_REF, ['sensitivity']) } }))).toBe(true);
        // Different shape: required at the top level, sibling to allOf, instead of inside it.
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: topLevelStandard(RELATIONSHIP_REF, ['dataClassification', 'encrypted']) } }))).toBe(true);
        // allOf present but $refs the wrong core definition.
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: standard(NODE_REF, ['encrypted']) } }))).toBe(false);
        // Correct $ref but nothing required.
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: standard(RELATIONSHIP_REF, []) } }))).toBe(false);
        // A half-edited file: must not tick, must not throw.
        expect(relationshipStandard.check(state({ files: { [RELATIONSHIP_STD]: standard(RELATIONSHIP_REF, ['encrypted']).slice(0, 30) } }))).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_18);
        for (const step of INTERMEDIATE_18.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('links to the next lesson', () => {
        expect(INTERMEDIATE_18.completion.links).toContainEqual({
            to: '?lesson=intermediate-19',
            label: 'Next lesson: Enforcing standards with patterns',
        });
    });
});
