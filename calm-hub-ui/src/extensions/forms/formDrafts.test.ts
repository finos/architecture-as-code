import { describe, expect, it, vi } from 'vitest';
import type { ExtensionService, FormOutcome, FormSubmission } from '../../service/extension-service.js';
import { FormDrafts } from './formDrafts.js';

const KEY = 'draft';
const FIRST = { namespace: 'finos', resource: 'architectures/1', version: '1.0.0' };
const SECOND = { namespace: 'finos', resource: 'architectures/2', version: '1.0.0' };

/** A service whose replies the test settles one at a time. */
function service() {
    const sent: FormSubmission[] = [];
    const replies: ((outcome: FormOutcome) => void)[] = [];
    const submitForm = vi.fn((_id: string, _form: string, body: FormSubmission) => {
        sent.push(body);
        return new Promise<FormOutcome>((resolve) => replies.push(resolve));
    });
    return { service: { submitForm } as unknown as ExtensionService, sent, reply: (outcome: FormOutcome) => replies.shift()!(outcome) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

function submit(drafts: FormDrafts, svc: ExtensionService, input: Record<string, string>, onSuccess = vi.fn(), target = FIRST) {
    return drafts.submit(KEY, { service: svc, extensionId: 'ext', formId: 'form', target, input, keepTarget: false, onSuccess });
}

describe('FormDrafts', () => {
    it('pins the target at the first edit', () => {
        const drafts = new FormDrafts();
        drafts.edit(KEY, 'note', 'a', FIRST);
        drafts.edit(KEY, 'note', 'ab', SECOND);
        expect(drafts.get(KEY)?.target).toEqual(FIRST);
        expect(drafts.get(KEY)?.values).toEqual({ note: 'ab' });
        expect(drafts.hasUnsent()).toBe(true);
    });

    it('sends once while a submission is in flight, and ignores edits and a discard until it ends', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        drafts.edit(KEY, 'note', 'a', FIRST);
        const first = submit(drafts, svc, { note: 'a' });
        void submit(drafts, svc, { note: 'a' });
        drafts.edit(KEY, 'note', 'changed', FIRST);
        drafts.discard(KEY);

        expect(sent).toHaveLength(1);
        expect(drafts.get(KEY)).toMatchObject({ phase: 'pending', values: { note: 'a' } });
        expect(drafts.hasUnsent()).toBe(true);
        reply({ kind: 'failed', sent: false, message: 'Busy' });
        await first;
        expect(drafts.get(KEY)).toMatchObject({ phase: 'failed', message: 'Busy', values: { note: 'a' }, dirty: true });
    });

    it('while an earlier send may have been saved, sends only its repeat, with the same id', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        const send = async (input: Record<string, string>, outcome?: FormOutcome, target = FIRST) => {
            const before = sent.length;
            const done = submit(drafts, svc, input, vi.fn(), target);
            if (sent.length > before) reply(outcome!);
            await done;
        };

        await send({ note: 'A' }, { kind: 'unknown' });
        const first = sent[0].submission;
        // Changed input or another target is not sent: with a new id, the backend could save it and the first send.
        await send({ note: 'B' });
        await send({ note: 'A' }, undefined, SECOND);
        expect(sent).toHaveLength(1);
        expect(drafts.get(KEY)).toMatchObject({ phase: 'unknown', unresolved: { id: first } });
        expect(drafts.hasUnsent()).toBe(true);

        // Back to the same input, with no send between: a repeat with the first id.
        await send({ note: 'A' }, { kind: 'unknown' });
        expect(sent.map((body) => body.submission)).toEqual([first, first]);
        await send({ note: 'A' }, { kind: 'success' });
        // Settled: the next input is a new submission.
        await send({ note: 'B' }, { kind: 'unknown' });
        expect(sent).toHaveLength(4);
        expect(sent[3].submission).not.toBe(first);
    });

    it('sends changed input with a new id after the user forgets the earlier submission', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        drafts.edit(KEY, 'note', 'A', FIRST);
        const done = submit(drafts, svc, { note: 'A' });
        reply({ kind: 'unknown' });
        await done;
        drafts.edit(KEY, 'note', 'B', FIRST);

        drafts.forget(KEY);
        expect(drafts.get(KEY)).toMatchObject({ phase: 'editing', values: { note: 'B' }, dirty: true, target: FIRST });
        expect(drafts.get(KEY)?.unresolved).toBeUndefined();
        const next = submit(drafts, svc, { note: 'B' });
        reply({ kind: 'failed', sent: true });
        await next;
        expect(sent).toHaveLength(2);
        expect(sent[1].submission).not.toBe(sent[0].submission);
    });

    it('treats a confirmed failure as nothing saved, so the next send is new', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        for (const outcome of [
            { kind: 'failed', sent: true },
            { kind: 'failed', sent: false },
            { kind: 'failed', sent: true },
        ] as FormOutcome[]) {
            const done = submit(drafts, svc, { note: 'a' });
            reply(outcome);
            await done;
        }
        expect(new Set(sent.map((body) => body.submission)).size).toBe(3);
        expect(drafts.get(KEY)?.unresolved).toBeUndefined();
    });

    it('keeps an unknown outcome and its id when Hub refuses the repeat before it sends it', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        drafts.edit(KEY, 'note', 'a', FIRST);
        const send = async (outcome: FormOutcome) => {
            const done = submit(drafts, svc, { note: 'a' });
            reply(outcome);
            await done;
        };

        await send({ kind: 'unknown' });
        await send({ kind: 'failed', sent: false, message: 'The extension is busy' });
        // The refusal says nothing about the first send, which may have been saved.
        expect(drafts.get(KEY)).toMatchObject({ phase: 'unknown', message: 'The extension is busy' });
        expect(drafts.hasUnsent()).toBe(true);
        await send({ kind: 'success' });
        expect(sent.map((body) => body.submission)).toEqual([sent[0].submission, sent[0].submission, sent[0].submission]);
    });

    it('settles an unknown outcome when the backend refuses the repeat', async () => {
        const drafts = new FormDrafts();
        const { service: svc, sent, reply } = service();
        drafts.edit(KEY, 'note', 'a', FIRST);
        for (const outcome of [{ kind: 'unknown' }, { kind: 'failed', sent: true }, { kind: 'failed', sent: true }] as FormOutcome[]) {
            const done = submit(drafts, svc, { note: 'a' });
            reply(outcome);
            await done;
        }
        // The backend saw the id of the repeat and refused it, so nothing was saved and the next send is new.
        expect(drafts.get(KEY)?.phase).toBe('failed');
        expect(sent[1].submission).toBe(sent[0].submission);
        expect(sent[2].submission).not.toBe(sent[0].submission);
    });

    it('warns about an unknown outcome of input that the user did not edit, until it is discarded', async () => {
        const drafts = new FormDrafts();
        const { service: svc, reply } = service();
        const done = submit(drafts, svc, { note: 'default' });
        reply({ kind: 'unknown' });
        await done;
        expect(drafts.get(KEY)?.dirty).toBe(false);
        expect(drafts.hasUnsent()).toBe(true);
        drafts.discard(KEY);
        expect(drafts.hasUnsent()).toBe(false);
    });

    it('refreshes only after a confirmed success, and then clears the input', async () => {
        const drafts = new FormDrafts();
        const { service: svc, reply } = service();
        const onSuccess = vi.fn();
        drafts.edit(KEY, 'note', 'a', FIRST);
        for (const outcome of [{ kind: 'failed', sent: true }, { kind: 'unknown' }] as FormOutcome[]) {
            const done = submit(drafts, svc, { note: 'a' }, onSuccess);
            reply(outcome);
            await done;
        }
        expect(onSuccess).not.toHaveBeenCalled();

        const done = submit(drafts, svc, { note: 'a' }, onSuccess);
        reply({ kind: 'success', message: 'Review 12 opened.' });
        await done;
        expect(onSuccess).toHaveBeenCalledOnce();
        expect(drafts.get(KEY)).toMatchObject({ phase: 'success', message: 'Review 12 opened.', values: {}, dirty: false, sentTo: FIRST });
        expect(drafts.get(KEY)?.target).toBeUndefined();
        expect(drafts.hasUnsent()).toBe(false);
    });

    it('treats a rejected call as an unknown outcome', async () => {
        const drafts = new FormDrafts();
        const svc = { submitForm: vi.fn().mockRejectedValue(new Error('lost')) } as unknown as ExtensionService;
        await submit(drafts, svc, { note: 'a' });
        await settle();
        expect(drafts.get(KEY)?.phase).toBe('unknown');
    });
});
