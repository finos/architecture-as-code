import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_20 } from './lesson';
import { INTERMEDIATE_19 } from '../intermediate-19/lesson';
import { NODE_STD, RELATIONSHIP_STD } from '../intermediate-18/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const GENERATED = INTERMEDIATE_20.editorFile;
const WEB_APP = '/workspace/patterns/web-app-pattern.json';
const BASE = '/workspace/patterns/company-base-pattern.json';
const MAPPING = '/workspace/url-mapping.json';

const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
const RELATIONSHIP_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship';

/** The learner's own standards: other required property names than the hint. */
const standard = (ref: string, required: string[]) => JSON.stringify({ allOf: [{ $ref: ref }, { type: 'object', required }] });
const MY_STANDARDS = {
    [NODE_STD]: standard(NODE_REF, ['team']),
    [RELATIONSHIP_STD]: standard(RELATIONSHIP_REF, ['protocolVersion']),
};

const node = (id: string, over: Record<string, unknown> = {}) =>
    ({ 'unique-id': id, 'node-type': 'service', name: id, description: `The ${id}.`, team: 'payments', ...over });
const connects = (id: string, source: string, destination: string, over: Record<string, unknown> = {}) => ({
    'unique-id': id,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
    protocolVersion: '2',
    ...over,
});
const without = (item: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(item).filter(([name]) => name !== key));
const MY_DOC = { nodes: [node('auth-service'), node('user-store')], relationships: [connects('auth-to-store', 'auth-service', 'user-store')] };

const passed = (files: Record<string, string>, over: Partial<CommandOutcome> = {}): CommandOutcome => ({
    command: 'validate',
    files,
    ok: true,
    errorCount: 0,
    warningCount: 0,
    errorsIn: {},
    loadFailures: 0,
    snapshot: {},
    ...over,
});
const STANDARDS_RUN = passed({ architecture: GENERATED, pattern: BASE, mapping: MAPPING });
const WEB_APP_RUN = passed({ architecture: GENERATED, pattern: WEB_APP });

// The learner's own web application pattern, which MY_DOC follows.
const constItem = (properties: Record<string, unknown>) => ({ properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, { const: value }])) });
const MY_WEB_APP = JSON.stringify({
    properties: {
        nodes: { prefixItems: [constItem({ 'unique-id': 'auth-service', 'node-type': 'service' }), constItem({ 'unique-id': 'user-store', 'node-type': 'service' })] },
        relationships: { prefixItems: [constItem({ 'unique-id': 'auth-to-store' })] },
    },
});

const state = (over: Partial<LessonState>): LessonState => ({
    doc: MY_DOC,
    validation: { ok: true },
    commands: [],
    editorFile: GENERATED,
    files: { ...MY_STANDARDS, [WEB_APP]: MY_WEB_APP },
    ...over,
});

describe('intermediate-20 lesson', () => {
    const [nodeStandards, relationshipStandards, validateStandards, validateBoth] = INTERMEDIATE_20.steps;

    it('has four steps with unique ids', () => {
        expect(INTERMEDIATE_20.steps).toHaveLength(4);
        expect(new Set(INTERMEDIATE_20.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from intermediate-19 and edits the generated web application', () => {
        expect(INTERMEDIATE_20.chainsFrom).toBe('intermediate-19');
        expect(INTERMEDIATE_20.seedFiles).toEqual(endFiles(INTERMEDIATE_19));
        expect(GENERATED).toBe('/workspace/architectures/generated-webapp.json');
        expect(INTERMEDIATE_20.editableFiles).toContain(GENERATED);
    });

    it('node-standards needs every node to carry the properties the node standard requires', () => {
        expect(nodeStandards.check(state({}))).toBe(true);
        // One node without the property.
        expect(nodeStandards.check(state({ doc: { ...MY_DOC, nodes: [node('auth-service'), without(node('user-store'), 'team')] } }))).toBe(false);
        // The hint's property names, which the learner's standard does not require.
        expect(nodeStandards.check(state({ doc: { ...MY_DOC, nodes: [without(node('a', { costCenter: 'CC-1234', owner: 'x' }), 'team')] } }))).toBe(false);
        // No nodes.
        expect(nodeStandards.check(state({ doc: { nodes: [], relationships: [] } }))).toBe(false);
        // A valid shape in an invalid document (for example a relationship to a missing node).
        expect(nodeStandards.check(state({ validation: { ok: false } }))).toBe(false);
        // A standard that requires nothing does not make the step pass.
        expect(nodeStandards.check(state({ files: { ...MY_STANDARDS, [WEB_APP]: MY_WEB_APP, [NODE_STD]: standard(NODE_REF, []) } }))).toBe(false);
        // A half-edited editor file: must not tick, must not throw.
        expect(nodeStandards.check(state({ doc: null }))).toBe(false);
        // A compliant architecture that dropped a node, or changed a node-type, the web application pattern fixes.
        expect(nodeStandards.check(state({ doc: { ...MY_DOC, nodes: [node('auth-service'), node('other-store')] } }))).toBe(false);
        expect(nodeStandards.check(state({ doc: { ...MY_DOC, nodes: [node('auth-service'), node('user-store', { 'node-type': 'database' })] } }))).toBe(false);
    });

    it('relationship-standards needs every relationship to carry the properties the relationship standard requires', () => {
        expect(relationshipStandards.check(state({}))).toBe(true);
        // A relationship without the property.
        const bare = without(connects('store-to-auth', 'user-store', 'auth-service'), 'protocolVersion');
        expect(relationshipStandards.check(state({ doc: { ...MY_DOC, relationships: [...MY_DOC.relationships, bare] } }))).toBe(false);
        // The hint's property names, which the learner's standard does not require.
        const hintNames = without(connects('auth-to-store', 'auth-service', 'user-store', { dataClassification: 'internal', encrypted: true }), 'protocolVersion');
        expect(relationshipStandards.check(state({ doc: { ...MY_DOC, relationships: [hintNames] } }))).toBe(false);
        // No relationships.
        expect(relationshipStandards.check(state({ doc: { nodes: MY_DOC.nodes, relationships: [] } }))).toBe(false);
        // A valid shape in an invalid document.
        expect(relationshipStandards.check(state({ validation: { ok: false } }))).toBe(false);
        // A standard that requires nothing does not make the step pass.
        expect(relationshipStandards.check(state({ files: { ...MY_STANDARDS, [WEB_APP]: MY_WEB_APP, [RELATIONSHIP_STD]: standard(RELATIONSHIP_REF, []) } }))).toBe(false);
        // A half-edited editor file: must not tick, must not throw.
        expect(relationshipStandards.check(state({ doc: null }))).toBe(false);
        // A compliant relationship with a unique-id other than the one the web application pattern fixes.
        expect(relationshipStandards.check(state({ doc: { ...MY_DOC, relationships: [connects('renamed', 'auth-service', 'user-store')] } }))).toBe(false);
    });

    it('validate-standards needs a fresh passing run against the base pattern with the mapping', () => {
        expect(validateStandards.check(state({ commands: [STANDARDS_RUN] }))).toBe(true);
        // No run, or a run without the mapping, or against the web-app pattern only.
        expect(validateStandards.check(state({}))).toBe(false);
        expect(validateStandards.check(state({ commands: [passed({ architecture: GENERATED, pattern: BASE })] }))).toBe(false);
        expect(validateStandards.check(state({ commands: [WEB_APP_RUN] }))).toBe(false);
        // Another architecture.
        expect(validateStandards.check(state({ commands: [passed({ architecture: '/workspace/architectures/compliant-test.json', pattern: BASE, mapping: MAPPING })] }))).toBe(false);
        // A failing run.
        expect(validateStandards.check(state({ commands: [passed(STANDARDS_RUN.files, { ok: false, errorCount: 1, errorsIn: { architecture: 1 } })] }))).toBe(false);
        // A passing run, but the saved file no longer carries the properties.
        expect(validateStandards.check(state({ doc: { ...MY_DOC, nodes: [without(node('auth-service'), 'team')] }, commands: [STANDARDS_RUN] }))).toBe(false);
    });

    it('validate-both needs fresh passing runs against both patterns', () => {
        expect(validateBoth.check(state({ commands: [WEB_APP_RUN, STANDARDS_RUN] }))).toBe(true);
        // Only one of the two runs.
        expect(validateBoth.check(state({ commands: [STANDARDS_RUN] }))).toBe(false);
        expect(validateBoth.check(state({ commands: [WEB_APP_RUN] }))).toBe(false);
        // The web-app pattern fails.
        expect(validateBoth.check(state({ commands: [passed(WEB_APP_RUN.files, { ok: false, errorCount: 2, errorsIn: { architecture: 2 } }), STANDARDS_RUN] }))).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_20);
        for (const step of INTERMEDIATE_20.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('makes both validate steps stale when the architecture or a standard changes after the runs', async () => {
        const replay = startReplay(INTERMEDIATE_20);
        for (const step of INTERMEDIATE_20.steps) {
            await replay.runHint(step);
        }
        expect(validateBoth.check(await replay.stateFor())).toBe(true);
        replay.vfs.write(GENERATED, `${replay.vfs.read(GENERATED)}\n`);
        const edited = await replay.stateFor();
        expect(validateStandards.check(edited)).toBe(false);
        expect(validateBoth.check(edited)).toBe(false);

        const again = startReplay(INTERMEDIATE_20);
        for (const step of INTERMEDIATE_20.steps) {
            await again.runHint(step);
        }
        again.vfs.write(NODE_STD, `${again.vfs.read(NODE_STD)}\n`);
        const standardEdited = await again.stateFor();
        expect(validateStandards.check(standardEdited)).toBe(false);
        expect(validateBoth.check(standardEdited)).toBe(false);
    });

    it('says the track is complete', () => {
        expect(INTERMEDIATE_20.completion.message).toMatch(/intermediate lessons/);
        expect(INTERMEDIATE_20.completion.message).toMatch(/Tutorials 11 to 16/);
    });
});
