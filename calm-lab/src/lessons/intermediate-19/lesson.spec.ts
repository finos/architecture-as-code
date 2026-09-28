import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_19 } from './lesson';
import { INTERMEDIATE_18, NODE_STD, RELATIONSHIP_STD } from '../intermediate-18/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import { hintContent, type LessonState } from '../types';

const [COMPLIANT, MAPPING, BASE] = INTERMEDIATE_19.editableFiles!;
const ECOMMERCE = '/workspace/architectures/ecommerce-platform.json';

const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
const RELATIONSHIP_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship';

/** The learner's own standards: other `$id`s and other required property names than the hint. */
const MY_NODE_ID = 'https://standards.acme.test/node.json';
const MY_RELATIONSHIP_ID = 'https://standards.acme.test/relationship.json';
const standard = (id: string, ref: string, required: string[]) => JSON.stringify({ $id: id, allOf: [{ $ref: ref }, { type: 'object', required }] });
const MY_STANDARDS = {
    [NODE_STD]: standard(MY_NODE_ID, NODE_REF, ['team']),
    [RELATIONSHIP_STD]: standard(MY_RELATIONSHIP_ID, RELATIONSHIP_REF, ['protocolVersion']),
};

const mapping = (entries: Record<string, string>) => ({ [MAPPING]: JSON.stringify(entries) });
const MY_MAPPING = mapping({ [MY_NODE_ID]: './standards/company-node-standard.json', [MY_RELATIONSHIP_ID]: 'standards/company-relationship-standard.json' });

const pattern = (nodeRef: string, relationshipRef: string) => JSON.stringify({
    $id: 'https://standards.acme.test/base.json',
    properties: {
        nodes: { type: 'array', items: { $ref: nodeRef } },
        relationships: { type: 'array', items: { $ref: relationshipRef } },
    },
});

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

const outcome = (over: Partial<CommandOutcome>): CommandOutcome => ({
    command: 'validate',
    files: { architecture: ECOMMERCE, pattern: BASE, mapping: MAPPING },
    ok: false,
    errorCount: 4,
    warningCount: 0,
    errorsIn: { architecture: 4 },
    loadFailures: 0,
    snapshot: {},
    ...over,
});
const passed = (over: Partial<CommandOutcome> = {}) =>
    outcome({ files: { architecture: COMPLIANT, pattern: BASE, mapping: MAPPING }, ok: true, errorCount: 0, errorsIn: {}, ...over });

const state = (over: Partial<LessonState>): LessonState => ({
    doc: null,
    validation: { ok: true },
    commands: [],
    editorFile: INTERMEDIATE_19.editorFile,
    files: { ...MY_STANDARDS },
    ...over,
});

describe('intermediate-19 lesson', () => {
    const [urlMapping, basePattern, seeItFail, compliant, validateCompliant] = INTERMEDIATE_19.steps;

    it('has five steps with unique ids', () => {
        expect(INTERMEDIATE_19.steps).toHaveLength(5);
        expect(new Set(INTERMEDIATE_19.steps.map((step) => step.id)).size).toBe(5);
    });

    it('chains from intermediate-18 and seeds the mapping, the base pattern and the compliant architecture', () => {
        expect(INTERMEDIATE_19.chainsFrom).toBe('intermediate-18');
        for (const [path, content] of Object.entries(endFiles(INTERMEDIATE_18))) {
            expect(INTERMEDIATE_19.seedFiles[path]).toBe(content);
        }
        expect(INTERMEDIATE_19.editorFile).toBe(COMPLIANT);
        expect(INTERMEDIATE_19.editableFiles).toEqual([COMPLIANT, MAPPING, BASE, NODE_STD, RELATIONSHIP_STD]);
        for (const path of [COMPLIANT, MAPPING, BASE]) {
            expect(INTERMEDIATE_19.seedFiles[path], path).toBeTypeOf('string');
        }
    });

    it('url-mapping maps the $id of each standard to its own file', () => {
        // Different $ids from the hint, read from the learner's standards.
        expect(urlMapping.check(state({ files: { ...MY_STANDARDS, ...MY_MAPPING } }))).toBe(true);
        // The stub.
        expect(urlMapping.check(state({ files: { ...MY_STANDARDS, [MAPPING]: INTERMEDIATE_19.seedFiles[MAPPING] } }))).toBe(false);
        // Only one standard mapped.
        expect(urlMapping.check(state({ files: { ...MY_STANDARDS, ...mapping({ [MY_NODE_ID]: 'standards/company-node-standard.json' }) } }))).toBe(false);
        // The tutorial's $ids, but the learner's standards have other $ids.
        const hint = urlMapping.hint;
        const tutorialMapping = hint.kind === 'file' ? hintContent(hint, { files: INTERMEDIATE_19.seedFiles }) : '';
        expect(urlMapping.check(state({ files: { ...MY_STANDARDS, [MAPPING]: tutorialMapping } }))).toBe(false);
        // The two standards swapped.
        expect(urlMapping.check(state({
            files: { ...MY_STANDARDS, ...mapping({ [MY_NODE_ID]: 'standards/company-relationship-standard.json', [MY_RELATIONSHIP_ID]: 'standards/company-node-standard.json' }) },
        }))).toBe(false);
        // A typo in one path: the file does not exist.
        expect(urlMapping.check(state({
            files: { ...MY_STANDARDS, ...mapping({ [MY_NODE_ID]: 'standards/company-node-standard.json', [MY_RELATIONSHIP_ID]: 'standard/company-relationship-standard.json' }) },
        }))).toBe(false);
        // Both standards mapped, but an extra entry names a missing file.
        expect(urlMapping.check(state({
            files: { ...MY_STANDARDS, ...mapping({ ...JSON.parse(MY_MAPPING[MAPPING]), 'https://standards.acme.test/base.json': 'patterns/missing.json' }) },
        }))).toBe(false);
        // A half-edited file: must not tick, must not throw.
        expect(urlMapping.check(state({ files: { ...MY_STANDARDS, [MAPPING]: MY_MAPPING[MAPPING].slice(0, 40) } }))).toBe(false);
    });

    it('base-pattern $refs the mapped $id of both standards', () => {
        const files = { ...MY_STANDARDS, ...MY_MAPPING };
        expect(basePattern.check(state({ files: { ...files, [BASE]: pattern(MY_NODE_ID, MY_RELATIONSHIP_ID) } }))).toBe(true);
        // A different shape: both refs through allOf, still under items.
        const allOf = JSON.stringify({ properties: { nodes: { items: { allOf: [{ $ref: MY_NODE_ID }] } }, relationships: { items: { allOf: [{ $ref: MY_RELATIONSHIP_ID }] } } } });
        expect(basePattern.check(state({ files: { ...files, [BASE]: allOf } }))).toBe(true);
        // The stub.
        expect(basePattern.check(state({ files: { ...files, [BASE]: INTERMEDIATE_19.seedFiles[BASE] } }))).toBe(false);
        // Only the node standard.
        expect(basePattern.check(state({ files: { ...files, [BASE]: pattern(MY_NODE_ID, RELATIONSHIP_REF) } }))).toBe(false);
        // The hint's URLs, which are not the learner's standards.
        expect(basePattern.check(state({ files: { ...files, [BASE]: (INTERMEDIATE_19.steps[1].hint as { content: string }).content } }))).toBe(false);
        // Both refs, but the mapping does not name the relationship standard.
        const partial = { ...MY_STANDARDS, ...mapping({ [MY_NODE_ID]: 'standards/company-node-standard.json' }) };
        expect(basePattern.check(state({ files: { ...partial, [BASE]: pattern(MY_NODE_ID, MY_RELATIONSHIP_ID) } }))).toBe(false);
        // Both refs, but only in $defs, not under the arrays.
        const elsewhere = JSON.stringify({ $defs: { nodes: { $ref: MY_NODE_ID }, relationships: { $ref: MY_RELATIONSHIP_ID } }, properties: {} });
        expect(basePattern.check(state({ files: { ...files, [BASE]: elsewhere } }))).toBe(false);
        // Both refs under prefixItems: they check only the first element, not every one.
        const prefixOnly = JSON.stringify({ properties: { nodes: { prefixItems: [{ $ref: MY_NODE_ID }] }, relationships: { prefixItems: [{ $ref: MY_RELATIONSHIP_ID }] } } });
        expect(basePattern.check(state({ files: { ...files, [BASE]: prefixOnly } }))).toBe(false);
        // Each standard wired to the other array.
        expect(basePattern.check(state({ files: { ...files, [BASE]: pattern(MY_RELATIONSHIP_ID, MY_NODE_ID) } }))).toBe(false);
        // Both refs under nodes; relationships left unconstrained.
        const nodesOnly = JSON.stringify({ properties: { nodes: { items: { allOf: [{ $ref: MY_NODE_ID }, { $ref: MY_RELATIONSHIP_ID }] } }, relationships: { type: 'array' } } });
        expect(basePattern.check(state({ files: { ...files, [BASE]: nodesOnly } }))).toBe(false);
        // A half-edited file: must not tick, must not throw.
        expect(basePattern.check(state({ files: { ...files, [BASE]: pattern(MY_NODE_ID, MY_RELATIONSHIP_ID).slice(0, 60) } }))).toBe(false);
    });

    it('see-it-fail needs the engine to reject the e-commerce architecture itself', () => {
        expect(seeItFail.check(state({ commands: [outcome({})] }))).toBe(true);
        // A pattern error or a mapped file that does not load.
        expect(seeItFail.check(state({ commands: [outcome({ errorsIn: { architecture: 3, pattern: 1 } })] }))).toBe(false);
        expect(seeItFail.check(state({ commands: [outcome({ loadFailures: 1 })] }))).toBe(false);
        // Without the mapping, or another architecture.
        expect(seeItFail.check(state({ commands: [outcome({ files: { architecture: ECOMMERCE, pattern: BASE } })] }))).toBe(false);
        expect(seeItFail.check(state({ commands: [outcome({ files: { architecture: COMPLIANT, pattern: BASE, mapping: MAPPING } })] }))).toBe(false);
        // A passing run.
        expect(seeItFail.check(state({ commands: [outcome({ ok: true, errorCount: 0, errorsIn: {} })] }))).toBe(false);
    });

    it('compliant needs every node and relationship to carry the properties the standards require', () => {
        expect(compliant.check(state({ doc: MY_DOC }))).toBe(true);
        // The seed: no nodes, no relationships.
        expect(compliant.check(state({ doc: { nodes: [], relationships: [] } }))).toBe(false);
        // One node without the property.
        expect(compliant.check(state({ doc: { ...MY_DOC, nodes: [node('auth-service'), without(node('user-store'), 'team')] } }))).toBe(false);
        // A relationship without the property.
        expect(compliant.check(state({ doc: { ...MY_DOC, relationships: [without(connects('auth-to-store', 'auth-service', 'user-store'), 'protocolVersion')] } }))).toBe(false);
        // Nodes only.
        expect(compliant.check(state({ doc: { nodes: MY_DOC.nodes, relationships: [] } }))).toBe(false);
        // The hint's property names, which the learner's standards do not require.
        expect(compliant.check(state({ doc: { nodes: [without(node('a', { costCenter: 'CC-1234', owner: 'x' }), 'team')], relationships: MY_DOC.relationships } }))).toBe(false);
        // A valid shape in an invalid document (for example a relationship to a missing node).
        expect(compliant.check(state({ doc: MY_DOC, validation: { ok: false } }))).toBe(false);
        // A standard that requires nothing does not make the step pass.
        expect(compliant.check(state({ doc: MY_DOC, files: { ...MY_STANDARDS, [NODE_STD]: standard(MY_NODE_ID, NODE_REF, []) } }))).toBe(false);
    });

    it('validate-compliant needs a fresh passing run against the base pattern with the mapping', () => {
        const files = { ...MY_STANDARDS, ...MY_MAPPING, [BASE]: pattern(MY_NODE_ID, MY_RELATIONSHIP_ID) };
        const check = (over: Partial<LessonState>) => validateCompliant.check(state({ files, ...over }));
        expect(check({ doc: MY_DOC, commands: [passed()] })).toBe(true);
        // No run, or a run without the pattern or the mapping.
        expect(check({ doc: MY_DOC })).toBe(false);
        expect(check({ doc: MY_DOC, commands: [passed({ files: { architecture: COMPLIANT } })] })).toBe(false);
        expect(check({ doc: MY_DOC, commands: [passed({ files: { architecture: COMPLIANT, pattern: BASE } })] })).toBe(false);
        // A passing run on the empty seed.
        expect(check({ doc: { nodes: [], relationships: [] }, commands: [passed()] })).toBe(false);
        // A failing run.
        expect(check({ doc: MY_DOC, commands: [passed({ ok: false, errorCount: 1, errorsIn: { architecture: 1 } })] })).toBe(false);
        // A base pattern that no longer references the standards.
        expect(check({ doc: MY_DOC, commands: [passed()], files: { ...files, [BASE]: pattern(NODE_REF, RELATIONSHIP_REF) } })).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_19);
        for (const step of INTERMEDIATE_19.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('builds the file hints from the learner\'s own standards', async () => {
        const replay = startReplay(INTERMEDIATE_19);
        for (const [path, content] of Object.entries(MY_STANDARDS)) {
            replay.vfs.write(path, content);
        }
        for (const step of INTERMEDIATE_19.steps) {
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('makes validate-compliant stale when a standard changes after the run', async () => {
        const replay = startReplay(INTERMEDIATE_19);
        for (const step of INTERMEDIATE_19.steps) {
            await replay.runHint(step);
        }
        expect(validateCompliant.check(await replay.stateFor())).toBe(true);
        replay.vfs.write(NODE_STD, `${replay.vfs.read(NODE_STD)}\n`);
        expect(validateCompliant.check(await replay.stateFor())).toBe(false);
    });

    it('has no completion links yet', () => {
        expect(INTERMEDIATE_19.completion.links).toEqual([]);
    });
});
