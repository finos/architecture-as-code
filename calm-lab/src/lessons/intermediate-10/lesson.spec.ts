import { describe, it, expect } from 'vitest';
import { INTERMEDIATE_10 } from './lesson';
import { INTERMEDIATE_09 } from '../intermediate-09/lesson';
import { endFiles } from '../chain';
import { startReplay } from '../replay';
import type { CommandOutcome } from '../../cli/outcome';
import type { LessonState } from '../types';

const [EDITOR_FILE, ADR_1, ADR_2] = INTERMEDIATE_10.editableFiles!;

const filledAdrText = (decision: string, todoSection?: 'status' | 'context' | 'decision' | 'consequences') => {
    const sections: Record<string, string> = {
        status: 'Accepted',
        context: 'Some context for this decision.',
        decision: decision,
        consequences: 'Some consequences of this decision.',
    };
    if (todoSection) {
        sections[todoSection] = 'TODO: fill this in.';
    }
    return `# A decision\n\n## Status\n${sections.status}\n\n## Context\n${sections.context}\n\n` +
        `## Decision\n${sections.decision}\n\n## Consequences\n${sections.consequences}\n`;
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
    editorFile: INTERMEDIATE_10.editorFile,
    files: {},
    ...over,
});

describe('intermediate-10 lesson', () => {
    const [adrQueue, adrOauth, linkAdrs, validate] = INTERMEDIATE_10.steps;

    it('has four steps with unique ids', () => {
        expect(INTERMEDIATE_10.steps).toHaveLength(4);
        expect(new Set(INTERMEDIATE_10.steps.map((step) => step.id)).size).toBe(4);
    });

    it('chains from intermediate-09 and keeps the same editor file', () => {
        expect(INTERMEDIATE_10.chainsFrom).toBe('intermediate-09');
        expect(INTERMEDIATE_10.editorFile).toBe(INTERMEDIATE_09.editorFile);
        expect(EDITOR_FILE).toBe(INTERMEDIATE_09.editorFile);
        for (const [path, content] of Object.entries(endFiles(INTERMEDIATE_09))) {
            expect(INTERMEDIATE_10.seedFiles[path]).toBe(content);
        }
    });

    it('seeds both ADRs as MADR templates with TODO placeholders', () => {
        expect(INTERMEDIATE_10.seedFiles[ADR_1]).toContain('## Status');
        expect(INTERMEDIATE_10.seedFiles[ADR_1]).toContain('TODO');
        expect(INTERMEDIATE_10.seedFiles[ADR_2]).toContain('## Consequences');
        expect(INTERMEDIATE_10.seedFiles[ADR_2]).toContain('TODO');
    });

    it('every file hint targets an editable file', () => {
        for (const step of INTERMEDIATE_10.steps) {
            if (step.hint.kind === 'file') {
                expect(INTERMEDIATE_10.editableFiles, step.id).toContain(step.hint.path ?? INTERMEDIATE_10.editorFile);
            }
        }
    });

    it('adr-queue needs the message queue ADR filled in, with no TODO left', () => {
        expect(adrQueue.check(state({ files: { [ADR_1]: INTERMEDIATE_10.seedFiles[ADR_1] } }))).toBe(false);
        // Different words from the hint: still passes.
        expect(adrQueue.check(state({ files: { [ADR_1]: filledAdrText('Use Kafka instead of RabbitMQ.') } }))).toBe(true);
        // A TODO left in one section: must not tick.
        expect(adrQueue.check(state({ files: { [ADR_1]: filledAdrText('Use a queue.', 'decision') } }))).toBe(false);
    });

    it('adr-oauth needs the OAuth2 ADR filled in, with no TODO left', () => {
        expect(adrOauth.check(state({ files: { [ADR_2]: INTERMEDIATE_10.seedFiles[ADR_2] } }))).toBe(false);
        expect(adrOauth.check(state({ files: { [ADR_2]: filledAdrText('Use OAuth2 with JWTs.') } }))).toBe(true);
        expect(adrOauth.check(state({ files: { [ADR_2]: filledAdrText('Use OAuth2.', 'context') } }))).toBe(false);
    });

    it('link-adrs needs two adrs entries that resolve to existing, filled ADR files, in a valid document', () => {
        const filledFiles = { [ADR_1]: filledAdrText('Use RabbitMQ.'), [ADR_2]: filledAdrText('Use OAuth2.') };
        expect(linkAdrs.check(state({ doc: {}, files: filledFiles }))).toBe(false);
        // Different relative paths and file names from the hint: still passes.
        const customFiles = {
            '/workspace/docs/decisions/queue.md': filledAdrText('Use RabbitMQ.'),
            '/workspace/docs/decisions/auth.md': filledAdrText('Use OAuth2.'),
        };
        expect(linkAdrs.check(state({
            doc: { adrs: ['docs/decisions/queue.md', 'docs/decisions/auth.md'] },
            files: customFiles,
        }))).toBe(true);
        // Right shape, invalid document: must not tick.
        expect(linkAdrs.check(state({
            doc: { adrs: [ADR_1.slice('/workspace/'.length), ADR_2.slice('/workspace/'.length)] },
            files: filledFiles,
            validation: { ok: false },
        }))).toBe(false);
        // One entry names a file that does not exist: must not tick.
        expect(linkAdrs.check(state({
            doc: { adrs: [ADR_1.slice('/workspace/'.length), 'docs/adr/missing.md'] },
            files: filledFiles,
        }))).toBe(false);
        // Both entries resolve, but one ADR still has a TODO decision: must not tick.
        expect(linkAdrs.check(state({
            doc: { adrs: [ADR_1.slice('/workspace/'.length), ADR_2.slice('/workspace/'.length)] },
            files: { [ADR_1]: filledAdrText('Use RabbitMQ.', 'decision'), [ADR_2]: filledAdrText('Use OAuth2.') },
        }))).toBe(false);
    });

    it('validate needs linked, filled ADRs AND a fresh validate of the editor file', () => {
        const linkedFiles = { [ADR_1]: filledAdrText('Use RabbitMQ.'), [ADR_2]: filledAdrText('Use OAuth2.') };
        const doc = { adrs: [ADR_1.slice('/workspace/'.length), ADR_2.slice('/workspace/'.length)] };
        const editorValidate = validateOutcome(INTERMEDIATE_10.editorFile, true);
        expect(validate.check(state({ doc, files: linkedFiles }))).toBe(false);
        expect(validate.check(state({ doc, files: linkedFiles, commands: [editorValidate] }))).toBe(true);
        expect(validate.check(state({ doc, files: linkedFiles, commands: [validateOutcome(INTERMEDIATE_10.editorFile, false)] }))).toBe(false);
        // A fresh validate, but the adrs array is missing one entry: must not tick.
        expect(validate.check(state({
            doc: { adrs: [ADR_1.slice('/workspace/'.length)] },
            files: linkedFiles,
            commands: [editorValidate],
        }))).toBe(false);
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(INTERMEDIATE_10);
        for (const step of INTERMEDIATE_10.steps) {
            expect(step.check(await replay.stateFor()), `${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), step.id).toBe(true);
        }
    });

    it('has no completion links yet', () => {
        expect(INTERMEDIATE_10.completion.links).toEqual([]);
    });
});
