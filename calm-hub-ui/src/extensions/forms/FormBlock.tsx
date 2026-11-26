import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ExtensionContext, ExtensionForm, ExtensionRoute, ExtensionSummary } from '../../model/extensions.js';
import { ConfirmActionDialog } from '../ConfirmActionDialog.js';
import { useExtensionService } from '../ExtensionsContext.js';
import { useExtensionRefresh } from '../extensionRefresh.js';
import { Heading, HeadingLevel } from '../Heading.js';
import { formDraftKey, payloadOf, useFormDraft, useFormDrafts } from './formDrafts.js';
import { FormFieldInput } from './FormFieldInput.js';
import { checkValues, FormInput, formTarget, initialValues, own, sameTarget, targetName } from './formRules.js';
import { FormTargetPicker } from './FormTargetPicker.js';
import { InlineConfirm } from './InlineConfirm.js';

/** The extension points whose slots can show a form. */
export type FormPoint = 'screen' | 'designer-tab' | 'detail-panel';

/** The slot that shows a form block: the draft key uses its point and contribution, and the context gives the target. */
export interface FormSlot {
    extension: ExtensionSummary;
    point: FormPoint;
    contributionId: string;
    context: ExtensionContext;
}

interface FormBlockProps {
    formId: string;
    slot: FormSlot;
    /** The level of the slot title. The form title goes one below it. */
    headingLevel: HeadingLevel;
}

export function FormBlock({ formId, slot, headingLevel }: FormBlockProps) {
    const form = slot.extension.contributes.form?.find((entry) => entry.id === formId);
    const route = form && slot.extension.routes.find((entry) => entry.id === form.route);
    // A read-only Hub leaves out a write form, and a newer backend can name a form that this manifest does not have.
    if (!form || !route) {
        return (
            <div role="alert" className="alert alert-warning">
                <span>This form is not available on this CALM Hub.</span>
            </div>
        );
    }
    return <FormView form={form} route={route} slot={slot} headingLevel={headingLevel} />;
}

const NEEDS_TARGET = {
    resource: 'Open an architecture or a pattern to fill this form.',
    element: 'Select a node on the diagram to fill this form.',
} as const;

function FormView({ form, route, slot, headingLevel }: { form: ExtensionForm; route: ExtensionRoute } & Omit<FormBlockProps, 'formId'>) {
    const { extension, point, contributionId, context } = slot;
    const service = useExtensionService();
    const refresh = useExtensionRefresh();
    const drafts = useFormDrafts();
    const key = formDraftKey(extension.id, form.id, `${point}:${contributionId}`);
    const draft = useFormDraft(drafts, key);
    const baseId = useId();
    const [confirming, setConfirming] = useState<{ target: ExtensionContext; input: FormInput }>();
    const [asking, setAsking] = useState<'discard' | 'forget'>();
    const [targetError, setTargetError] = useState<string>();
    const submitButton = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef(false);

    // A screen form has its own target picker. A typed screen link can fill it from its context.
    const picks = point === 'screen' && form.target !== 'none';
    const live = formTarget(form, context);
    const chosen = draft?.target ?? context;
    // An empty context is not a choice, so an edit does not pin it, and a later screen link can still fill the picker.
    const pickedContext = Object.keys(context).length > 0 ? context : undefined;
    const target = picks ? formTarget(form, chosen) : (draft?.target ?? live);
    const values = { ...initialValues(form), ...draft?.values };
    const { input, errors: checkErrors } = checkValues(form, values);
    const phase = draft?.phase ?? 'editing';
    const pending = phase === 'pending';
    const fieldErrors = draft?.fieldErrors ?? {};
    const repeat = !!target && draft?.unresolved?.payload === payloadOf(target, input);
    // The form sends nothing but a repeat until the earlier submission is settled, so the backend cannot save both.
    const held = !!draft?.unresolved && !repeat;
    const unresolvedId = `${baseId}-unresolved`;
    const fieldId = (id: string) => `${baseId}-${id}`;

    useEffect(() => {
        if (confirming || !returnFocus.current) return;
        returnFocus.current = false;
        submitButton.current?.focus();
    }, [confirming]);

    const send = (sendTo: ExtensionContext, sent: FormInput) =>
        drafts.submit(key, {
            service,
            extensionId: extension.id,
            formId: form.id,
            target: sendTo,
            input: sent,
            keepTarget: picks,
            // A readOnly route changed nothing, so the other views stay as they are.
            onSuccess: () => route.readOnly || refresh.refresh(extension.id),
        });

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (pending || held) return;
        const missingTarget = target
            ? undefined
            : picks
              ? 'Choose each part of the target.'
              : NEEDS_TARGET[form.target as 'resource' | 'element'];
        setTargetError(missingTarget);
        const first = form.fields.find((field) => own(checkErrors, field.id));
        if (first || missingTarget) {
            drafts.update(key, (current) => ({ ...current, fieldErrors: checkErrors }));
            // The first problem on the page: the target chooser is above the fields.
            const focus = missingTarget && picks ? `${baseId}-target-namespace` : first && fieldId(first.id);
            if (focus) document.getElementById(focus)?.focus();
            return;
        }
        if (route.readOnly) send(target!, input);
        else setConfirming({ target: target!, input });
    };

    const notice = !picks && draft?.target && !sameTarget(draft.target, live);
    // In a node panel only the node changes, so the button names only the node.
    const sameResource =
        live &&
        draft?.target &&
        targetName({ ...live, selectedElement: undefined }) === targetName({ ...draft.target, selectedElement: undefined });
    const liveName = live && (sameResource && live.selectedElement ? `node ${live.selectedElement}` : targetName(live));
    const sentTo = draft?.sentTo && form.target !== 'none' ? ` for ${targetName(draft.sentTo)}` : '';
    const errorCount = form.fields.filter((field) => own(fieldErrors, field.id)).length;
    const problemCount = errorCount + (targetError ? 1 : 0);
    const formHeading = Math.min(headingLevel + 1, 6) as HeadingLevel;

    return (
        <form
            className="flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-4 min-w-0"
            aria-labelledby={`${baseId}-title`}
            noValidate
            onSubmit={onSubmit}
        >
            <div>
                <Heading level={formHeading} className="text-base font-semibold">
                    <span id={`${baseId}-title`}>{form.title}</span>
                </Heading>
                {form.description && <p className="text-sm text-base-content/70">{form.description}</p>}
            </div>
            {problemCount > 0 && phase !== 'failed' && (
                <p role="alert" className="text-sm text-error">
                    Check the {problemCount === 1 ? 'part' : `${problemCount} parts`} marked below.
                </p>
            )}

            {picks ? (
                <FormTargetPicker
                    target={chosen}
                    element={form.target === 'element'}
                    disabled={pending}
                    idPrefix={`${baseId}-target`}
                    error={targetError}
                    onChange={(next) => {
                        setTargetError(undefined);
                        drafts.update(key, (current) => ({ ...current, target: next }));
                    }}
                />
            ) : (
                form.target !== 'none' && (
                    <div className="text-sm" data-testid="form-target">
                        {target ? (
                            <>
                                <p>
                                    <span className="text-base-content/60">Sends to </span>
                                    <span className="font-mono break-words">{targetName(target)}</span>
                                </p>
                                {draft?.target && (
                                    <p className="text-xs text-base-content/60">This form keeps this target while you complete it.</p>
                                )}
                            </>
                        ) : (
                            <p id={`${baseId}-target-error`} className={targetError ? 'text-error' : 'text-base-content/60'}>
                                {NEEDS_TARGET[form.target]}
                            </p>
                        )}
                    </div>
                )
            )}
            {notice && (
                <div className="alert alert-info text-sm flex flex-wrap gap-2" data-testid="retarget-notice">
                    <span>
                        The selection changed. This form still sends to <span className="font-mono">{targetName(draft!.target!)}</span>.
                    </span>
                    {live && !pending && (
                        <button
                            type="button"
                            className="btn btn-xs h-auto min-h-6 py-1 whitespace-normal text-left"
                            onClick={() => drafts.update(key, (current) => ({ ...current, target: live }))}
                        >
                            Send to {liveName} instead
                        </button>
                    )}
                </div>
            )}

            <fieldset className="flex flex-col gap-3 min-w-0" disabled={pending}>
                <legend className="sr-only">{form.title}</legend>
                {form.fields.map((field) => (
                    <FormFieldInput
                        key={field.id}
                        field={field}
                        id={fieldId(field.id)}
                        value={own(values, field.id) ?? ''}
                        error={own(fieldErrors, field.id)}
                        onChange={(value) => drafts.edit(key, field.id, value, picks ? pickedContext : live)}
                    />
                ))}
            </fieldset>

            {phase === 'unknown' && (
                <div role="alert" className="alert alert-warning text-sm flex flex-wrap gap-2">
                    <span id={unresolvedId}>
                        CALM Hub cannot confirm whether {extension.name} saved {held ? 'your earlier submission' : 'this'}
                        {sentTo}. It may have been saved.{' '}
                        {held
                            ? `You changed the input or the target, so the form does not send until the earlier submission is settled. To send it again, change the input back. Or check ${extension.name}, then forget it.`
                            : `Check before you send it again. If you send the same input again, ${extension.name} can see that it is a repeat.`}
                        {draft?.message && ` CALM Hub did not send the last try: ${draft.message}`}
                    </span>
                    {held &&
                        (asking === 'forget' ? (
                            <InlineConfirm
                                question="Forget the earlier submission?"
                                detail={`Check ${extension.name} first. If it saved the submission, a new send can save it a second time.`}
                                confirmLabel="Forget"
                                cancelLabel="Keep it"
                                onConfirm={() => {
                                    drafts.forget(key);
                                    setAsking(undefined);
                                    submitButton.current?.focus();
                                }}
                                onCancel={() => setAsking(undefined)}
                            />
                        ) : (
                            <button
                                type="button"
                                className="btn btn-xs h-auto min-h-6 py-1 whitespace-normal text-left"
                                onClick={() => setAsking('forget')}
                            >
                                Forget the earlier submission
                            </button>
                        ))}
                </div>
            )}
            {phase === 'failed' && (
                <div role="alert" className="alert alert-error text-sm">
                    <span>
                        Not saved. {draft?.message ?? 'The request failed.'}
                        {errorCount > 0 && ' Check the fields marked above.'} Your input is kept.
                    </span>
                </div>
            )}
            {phase === 'success' && (
                <div className="alert alert-success text-sm" data-testid="form-success">
                    <span>
                        Sent to {extension.name}
                        {sentTo}.{draft?.message && ` ${draft.message}`}
                    </span>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {/* aria-disabled, not disabled: focus goes back to the button after the dialog. */}
                <button
                    ref={submitButton}
                    type="submit"
                    className={`btn btn-primary btn-sm${pending || held ? ' btn-disabled' : ''}`}
                    aria-disabled={pending || held}
                    aria-describedby={held ? unresolvedId : undefined}
                >
                    {pending ? 'Sending…' : repeat ? 'Send again' : (form.submitLabel ?? 'Submit')}
                </button>
                {(draft?.dirty || draft?.unresolved) && !pending && asking !== 'discard' && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking('discard')}>
                        Clear
                    </button>
                )}
                {asking === 'discard' && (
                    <InlineConfirm
                        question="Discard your input?"
                        detail={
                            draft?.unresolved
                                ? `${extension.name} may have saved your earlier submission. Discarding does not undo it.`
                                : undefined
                        }
                        confirmLabel="Discard"
                        cancelLabel="Keep editing"
                        onConfirm={() => {
                            drafts.discard(key);
                            setAsking(undefined);
                            submitButton.current?.focus();
                        }}
                        onCancel={() => setAsking(undefined)}
                    />
                )}
            </div>
            {/* Always in the page: a screen reader may not read a live region that is added with its text. */}
            <p role="status" className="sr-only">
                {pending ? `${form.title}: sending…` : phase === 'success' ? `${form.title}: sent.` : ''}
            </p>

            {confirming && (
                <ConfirmActionDialog
                    title={form.title}
                    heading="Confirm submission"
                    question={`Send ${form.title} to ${extension.name}?`}
                    confirmLabel="Send"
                    target={confirming.target}
                    onConfirm={() => {
                        returnFocus.current = true;
                        const { target: sendTo, input: sent } = confirming;
                        setConfirming(undefined);
                        send(sendTo, sent);
                    }}
                    onCancel={() => {
                        returnFocus.current = true;
                        setConfirming(undefined);
                    }}
                />
            )}
        </form>
    );
}
