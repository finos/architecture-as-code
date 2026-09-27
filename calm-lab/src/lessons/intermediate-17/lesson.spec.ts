import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_17 } from './lesson';
import { INTERMEDIATE_10 } from '../intermediate-10/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const [GENERATED, PATTERN, BROKEN] = INTERMEDIATE_17.editableFiles!;

const item = (properties: Record<string, unknown>) => ({ type: 'object', properties });
const connects = (id: string, source: string, destination: string) =>
    item({ 'unique-id': { const: id }, 'relationship-type': { const: { connects: { source: { node: source }, destination: { node: destination } } } } });

/** A pattern with the learner's own ids; `over` replaces parts of `properties`. */
const pattern = (ids: string[], over: Record<string, unknown> = {}) => JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    $id: 'https://example.com/patterns/mine.json',
    type: 'object',
    properties: {
        nodes: {
            type: 'array', minItems: ids.length, maxItems: ids.length,
            prefixItems: ids.map((id) => item({ 'unique-id': { const: id }, 'node-type': { const: 'service' } })),
        },
        relationships: {
            type: 'array', minItems: 2, maxItems: 2,
            prefixItems: [connects('r1', ids[0], ids[1]), connects('r2', ids[1], ids[2])],
        },
        ...over,
    },
});

const MY_IDS = ['ui', 'auth-service', 'user-store'];
const MY_PATTERN = pattern(MY_IDS);

const node = (id: string, over: Record<string, unknown> = {}) =>
    ({ 'unique-id': id, 'node-type': 'service', name: id, description: `The ${id}.`, ...over });
const INTERFACE = { interfaces: [{ 'unique-id': 'https', host: 'example.com', port: 443 }] };

const outcome = (over: Partial<CommandOutcome>): CommandOutcome => ({
    command: 'validate',
    files: { architecture: GENERATED, pattern: PATTERN },
    ok: true,
    errorCount: 0,
    warningCount: 0,
    errorsIn: {},
    loadFailures: 0,
    snapshot: {},
    ...over,
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: INTERMEDIATE_17.editorFile,
    files: {},
    ...over,
});

describe('intermediate-17 lesson', () => {
    const [writePattern, generate, validatePattern, seeItFail, enhance, validateEnhanced] = INTERMEDIATE_17.steps;

    it('has six steps with unique ids', () => {
        expect(INTERMEDIATE_17.steps).toHaveLength(6);
        expect(new Set(INTERMEDIATE_17.steps.map((step) => step.id)).size).toBe(6);
    });

    it('chains from intermediate-10 and seeds the pattern, the generate target and the broken architecture', () => {
        expect(INTERMEDIATE_17.chainsFrom).toBe('intermediate-10');
        for (const [path, content] of Object.entries(endFiles(INTERMEDIATE_10))) {
            expect(INTERMEDIATE_17.seedFiles[path]).toBe(content);
        }
        expect(INTERMEDIATE_17.editorFile).toBe(GENERATED);
        for (const path of [GENERATED, PATTERN, BROKEN]) {
            expect(INTERMEDIATE_17.seedFiles[path], path).toBeTypeOf('string');
        }
    });

    it('write-pattern needs exactly three nodes and two relationships through prefixItems', () => {
        expect(writePattern.check(state({ files: { [PATTERN]: INTERMEDIATE_17.seedFiles[PATTERN] } }))).toBe(false);
        // Different ids and names from the hint: still passes.
        expect(writePattern.check(state({ files: { [PATTERN]: MY_PATTERN } }))).toBe(true);
        // Four nodes: not the three the step asks for.
        expect(writePattern.check(state({ files: { [PATTERN]: pattern([...MY_IDS, 'cache']) } }))).toBe(false);
        // Only two nodes: must not tick.
        expect(writePattern.check(state({ files: { [PATTERN]: pattern(['a', 'b', 'c'], { nodes: { minItems: 2, maxItems: 2, prefixItems: [{}, {}] } }) } }))).toBe(false);
        // Three prefixItems, but no maxItems: the count is not exact.
        expect(writePattern.check(state({ files: { [PATTERN]: pattern(['a', 'b', 'c'], { relationships: { minItems: 2, prefixItems: [{}, {}] } }) } }))).toBe(false);
        // Three constant nodes, but no constant unique-id: generate writes nothing that enhance can check.
        const unnamed = [0, 1, 2].map(() => item({ 'node-type': { const: 'service' }, name: { const: 'Service' } }));
        expect(writePattern.check(state({ files: { [PATTERN]: pattern(MY_IDS, { nodes: { minItems: 3, maxItems: 3, prefixItems: unnamed } }) } }))).toBe(false);
        expect(writePattern.check(state({ files: { [PATTERN]: pattern(MY_IDS, { nodes: { minItems: 3, maxItems: 3, prefixItems: [{}, {}, {}] } }) } }))).toBe(false);
        // A half-edited file: must not tick, must not throw.
        expect(writePattern.check(state({ files: { [PATTERN]: MY_PATTERN.slice(0, 40) } }))).toBe(false);
    });

    it('generate needs a fresh, successful generate from a complete pattern into the editor file', () => {
        const files = { [PATTERN]: MY_PATTERN };
        const generated = outcome({ command: 'generate', files: { pattern: PATTERN, output: GENERATED } });
        expect(generate.check(state({ files, commands: [generated] }))).toBe(true);
        expect(generate.check(state({ files, commands: [{ ...generated, ok: false, errorCount: 1 }] }))).toBe(false);
        expect(generate.check(state({ files, commands: [outcome({ command: 'generate', files: { pattern: PATTERN, output: '/workspace/other.json' } })] }))).toBe(false);
        // Generated from the stub pattern: must not tick.
        expect(generate.check(state({ files: { [PATTERN]: INTERMEDIATE_17.seedFiles[PATTERN] }, commands: [generated] }))).toBe(false);
    });

    it('validate-pattern needs a fresh, passing validate of the editor file against a complete pattern', () => {
        const files = { [PATTERN]: MY_PATTERN };
        expect(validatePattern.check(state({ files, commands: [outcome({})] }))).toBe(true);
        expect(validatePattern.check(state({ files, commands: [outcome({ ok: false, errorCount: 1, errorsIn: { architecture: 1 } })] }))).toBe(false);
        // Validated without the pattern: must not tick.
        expect(validatePattern.check(state({ files, commands: [outcome({ files: { architecture: GENERATED } })] }))).toBe(false);
        // Validated against an incomplete pattern: must not tick.
        expect(validatePattern.check(state({ files: { [PATTERN]: INTERMEDIATE_17.seedFiles[PATTERN] }, commands: [outcome({})] }))).toBe(false);
    });

    it('see-it-fail needs the engine to reject the broken architecture, not a load or pattern failure', () => {
        const files = { architecture: BROKEN, pattern: PATTERN };
        const failed = (over: Partial<CommandOutcome>) => outcome({ files, ok: false, errorCount: 3, ...over });
        expect(seeItFail.check(state({ commands: [failed({ errorsIn: { architecture: 3 } })] }))).toBe(true);
        expect(seeItFail.check(state({ commands: [outcome({ files })] }))).toBe(false);
        expect(seeItFail.check(state({ commands: [failed({ errorsIn: { pattern: 3 } })] }))).toBe(false);
        expect(seeItFail.check(state({ commands: [failed({ errorsIn: { architecture: 3 }, loadFailures: 1 })] }))).toBe(false);
        // The editor file rejected, not the broken one: must not tick.
        expect(seeItFail.check(state({ commands: [failed({ files: { architecture: GENERATED, pattern: PATTERN }, errorsIn: { architecture: 3 } })] }))).toBe(false);
    });

    describe('enhance and validate-enhanced', () => {
        const files = { [PATTERN]: MY_PATTERN };
        // Different ids from the hint, read from the learner's own pattern.
        const described = (description?: string) => ['r1', 'r2'].map((id) => ({ 'unique-id': id, ...(description === undefined ? {} : { description }) }));
        const doc = { nodes: [node('ui'), node('auth-service', INTERFACE), node('user-store', INTERFACE)], relationships: described('My own words.') };

        it('enhance needs the pattern\'s node ids, two nodes with interfaces, no placeholders and a valid document', () => {
            expect(enhance.check(state({ doc, files }))).toBe(true);
            // Interfaces on one node only: the step asks for the service and the database.
            expect(enhance.check(state({ doc: { ...doc, nodes: [node('ui'), node('auth-service', INTERFACE), node('user-store')] }, files }))).toBe(false);
            // Right shape, invalid document: must not tick.
            expect(enhance.check(state({ doc, files, validation: { ok: false } }))).toBe(false);
            // No interfaces yet, as generated.
            expect(enhance.check(state({ doc: { ...doc, nodes: MY_IDS.map((id) => node(id)) }, files }))).toBe(false);
            expect(enhance.check(state({ doc: { ...doc, nodes: [node('ui'), node('auth-service', { interfaces: [] }), node('user-store')] }, files }))).toBe(false);
            // A placeholder left in: must not tick.
            expect(enhance.check(state({ doc: { ...doc, nodes: [node('ui', { description: '[[ DESCRIPTION ]]' }), ...doc.nodes.slice(1)] }, files }))).toBe(false);
            // A required node renamed: must not tick.
            expect(enhance.check(state({ doc: { ...doc, nodes: [node('frontend'), ...doc.nodes.slice(1)] }, files }))).toBe(false);
            // A relationship with no description, an empty one, or no relationships: must not tick.
            expect(enhance.check(state({ doc: { ...doc, relationships: [...described('Fine.').slice(0, 1), ...described()] }, files }))).toBe(false);
            expect(enhance.check(state({ doc: { ...doc, relationships: described('') }, files }))).toBe(false);
            expect(enhance.check(state({ doc: { ...doc, relationships: [] }, files }))).toBe(false);
            // The pattern still a stub: no required ids, must not tick.
            expect(enhance.check(state({ doc, files: { [PATTERN]: INTERMEDIATE_17.seedFiles[PATTERN] } }))).toBe(false);
        });

        it('validate-enhanced needs the enhanced document AND a fresh validate against the pattern', () => {
            expect(validateEnhanced.check(state({ doc, files }))).toBe(false);
            expect(validateEnhanced.check(state({ doc, files, commands: [outcome({})] }))).toBe(true);
            expect(validateEnhanced.check(state({ doc, files, commands: [outcome({ files: { architecture: GENERATED } })] }))).toBe(false);
            expect(validateEnhanced.check(state({ doc: { ...doc, nodes: MY_IDS.map((id) => node(id)) }, files, commands: [outcome({})] }))).toBe(false);
        });
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_17);
        for (const step of INTERMEDIATE_17.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('does not tick generate for a successful run on the stub pattern', async () => {
        const replay = startReplay(INTERMEDIATE_17);
        await replay.runHint(generate);
        expect(generate.check(await replay.stateFor())).toBe(false);
    });

    it('does not tick generate when the pattern changes after the run', async () => {
        const replay = startReplay(INTERMEDIATE_17);
        await replay.runHint(INTERMEDIATE_17.steps[0]);
        await replay.runHint(generate);
        replay.vfs.write(PATTERN, MY_PATTERN);
        expect(generate.check(await replay.stateFor())).toBe(false);
    });

    it('has no completion links yet', () => {
        expect(INTERMEDIATE_17.completion.links).toEqual([]);
    });
});
