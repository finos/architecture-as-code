import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ExtensionContext } from '../../model/extensions.js';
import type { ExtensionService } from '../../service/extension-service.js';
import { FieldValue, FormInput, newSubmissionId } from './formRules.js';

export type FormPhase = 'editing' | 'pending' | 'success' | 'failed' | 'unknown';

export interface FormDraft {
    /** The values that the user changed. The form shows the field defaults for the others. */
    values: Record<string, FieldValue>;
    /** True after an edit, until a confirmed success or a discard. */
    dirty: boolean;
    /** The target that the form sends to. Set at the first edit and kept when the page context changes. */
    target?: ExtensionContext;
    phase: FormPhase;
    /**
     * A submission whose outcome is not known: the backend may have saved it. While it is set, the form sends only a
     * repeat of the same target and input, with the same id, so the backend can see that it is a repeat. Changed input
     * or another target waits. Only a success, a backend reply to that id, or `forget` settles it. A refusal by Hub
     * before it sent the repeat does not.
     */
    unresolved?: { id: string; payload: string };
    fieldErrors: Record<string, string>;
    /** A message from the backend: its success message, or why it refused. */
    message?: string;
    /** The target of the last result, so its notice names it after the target changes. */
    sentTo?: ExtensionContext;
}

export const EMPTY_DRAFT: FormDraft = { values: {}, dirty: false, phase: 'editing', fieldErrors: {} };

export interface SubmitRequest {
    service: ExtensionService;
    extensionId: string;
    formId: string;
    target: ExtensionContext;
    input: FormInput;
    /** Keep the target after a success: a target that the user chose on a screen, not one from the page. */
    keepTarget: boolean;
    onSuccess: () => void;
}

const without = (errors: Record<string, string>, id: string) => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== id));

/** The payload that a submission id stands for. */
export const payloadOf = (target: ExtensionContext, input: FormInput) => JSON.stringify([target, input]);

/**
 * The drafts of the forms on screen, by extension, form and placement. They live in the provider, not in the form, so
 * a remount, a collapsed section, a change of selection or a page change keeps the input and a submission in flight.
 */
export class FormDrafts {
    private readonly drafts = new Map<string, FormDraft>();
    private readonly listeners = new Set<() => void>();

    get(key: string): FormDraft | undefined {
        return this.drafts.get(key);
    }

    /** True while a form has input that was not sent, a submission that has not ended, or one that may have been saved. */
    hasUnsent(): boolean {
        return [...this.drafts.values()].some((draft) => draft.dirty || draft.phase === 'pending' || !!draft.unresolved);
    }

    update(key: string, change: (draft: FormDraft) => FormDraft): void {
        const draft = this.drafts.get(key) ?? EMPTY_DRAFT;
        if (draft.phase === 'pending') return;
        this.set(key, change(draft));
    }

    /** Sets a value. The first edit pins `target`, so a later change of selection does not retarget the form. */
    edit(key: string, fieldId: string, value: FieldValue, target: ExtensionContext | undefined): void {
        this.update(key, (draft) => ({
            ...draft,
            values: { ...draft.values, [fieldId]: value },
            dirty: true,
            target: draft.target ?? target,
            fieldErrors: without(draft.fieldErrors, fieldId),
            ...(draft.phase === 'success' ? { phase: 'editing' as const, message: undefined } : {}),
        }));
    }

    discard(key: string): void {
        if (this.drafts.get(key)?.phase === 'pending') return;
        this.set(key, undefined);
    }

    /** Drops an unresolved submission after the user checked the backend. The input stays, and its next send is new. */
    forget(key: string): void {
        this.update(key, (draft) => ({ ...draft, phase: 'editing', unresolved: undefined, message: undefined }));
    }

    /**
     * Sends the input once. A second call while one is in flight does nothing, and so does a call with another
     * payload while an earlier one is unresolved.
     */
    async submit(key: string, request: SubmitRequest): Promise<void> {
        const draft = this.drafts.get(key) ?? EMPTY_DRAFT;
        if (draft.phase === 'pending') return;
        const { service, extensionId, formId, target, input, keepTarget, onSuccess } = request;
        const payload = payloadOf(target, input);
        // Another payload would get its own id, and the backend could then save both it and the earlier send.
        if (draft.unresolved && draft.unresolved.payload !== payload) return;
        const id = draft.unresolved?.id ?? newSubmissionId();
        this.set(key, { ...draft, target, phase: 'pending', fieldErrors: {}, message: undefined });
        const outcome = await service
            .submitForm(extensionId, formId, { submission: id, context: target, input })
            .catch(() => ({ kind: 'unknown' as const }));
        const current = this.drafts.get(key) ?? EMPTY_DRAFT;
        if (outcome.kind === 'success') {
            this.set(key, {
                ...EMPTY_DRAFT,
                phase: 'success',
                message: outcome.message,
                sentTo: target,
                target: keepTarget ? target : undefined,
            });
            onSuccess();
        } else if (outcome.kind === 'failed') {
            // A refusal before Hub sent the repeat says nothing about the earlier send, which may have been saved.
            const unresolved = outcome.sent ? undefined : current.unresolved;
            this.set(key, {
                ...current,
                phase: unresolved ? 'unknown' : 'failed',
                unresolved,
                fieldErrors: outcome.fields ?? {},
                message: outcome.message,
                sentTo: target,
            });
        } else {
            this.set(key, { ...current, phase: 'unknown', unresolved: { id, payload }, sentTo: target });
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private set(key: string, draft: FormDraft | undefined) {
        if (draft) this.drafts.set(key, draft);
        else this.drafts.delete(key);
        this.listeners.forEach((listener) => listener());
    }
}

export const FormDraftsContext = createContext<FormDrafts | null>(null);

/** `placement` names the slot that shows the form, as `<extension point>:<contribution id>`. */
export const formDraftKey = (extensionId: string, formId: string, placement: string) => JSON.stringify([extensionId, formId, placement]);

/** The provider's drafts. Outside a provider, such as in a test, each component gets its own. */
export function useFormDrafts(): FormDrafts {
    const shared = useContext(FormDraftsContext);
    return useMemo(() => shared ?? new FormDrafts(), [shared]);
}

/** While `hasUnsent()` is true, the browser asks before it leaves or reloads the page. */
export function useUnsentWarning(drafts: FormDrafts): void {
    const unsent = useSyncExternalStore(
        (listener) => drafts.subscribe(listener),
        () => drafts.hasUnsent()
    );
    useEffect(() => {
        if (!unsent) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [unsent]);
}

export function useFormDraft(drafts: FormDrafts, key: string): FormDraft | undefined {
    return useSyncExternalStore(
        (listener) => drafts.subscribe(listener),
        () => drafts.get(key)
    );
}
