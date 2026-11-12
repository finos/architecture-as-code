import { useEffect, useRef, useState } from 'react';
import { ExtensionContext, ExtensionContribution, ExtensionRoute, ExtensionSummary } from '../model/extensions.js';
import { ExtensionService } from '../service/extension-service.js';
import { actionButtonKey, actionRunKey, useActionOutcome, useActionRunning, useActionRunningOn, useActionRuns } from './actionRuns.js';
import { ConfirmActionDialog } from './ConfirmActionDialog.js';

interface ExtensionActionButtonProps {
    service: ExtensionService;
    extension: ExtensionSummary;
    contribution: ExtensionContribution;
    route: ExtensionRoute;
    context: ExtensionContext;
    placement: string;
}

const contextKey = ({ namespace, resource, resourceType, resourceId, version, selectedElement }: ExtensionContext) =>
    JSON.stringify([namespace, resource, resourceType, resourceId, version, selectedElement]);

export function ExtensionActionButton({ service, extension, contribution, route, context, placement }: ExtensionActionButtonProps) {
    const runs = useActionRuns();
    const runKey = actionRunKey(extension.id, contribution.id);
    const busy = useActionRunning(runs, runKey);
    const outcomeKey = actionButtonKey(extension.id, contribution.id, placement);
    const outcome = useActionOutcome(runs, outcomeKey);
    const runningHere = useActionRunningOn(runs, outcomeKey);
    const [pending, setPending] = useState<ExtensionContext>();
    const readRequest = useRef<AbortController | null>(null);
    const button = useRef<HTMLButtonElement>(null);
    useEffect(() => () => readRequest.current?.abort(), []);

    const key = contextKey(context);
    // A result is for one context: a change of context clears it, so it cannot show again on a return to that context.
    useEffect(() => {
        if (outcome && outcome.for !== key) runs.clearOutcome(outcomeKey);
    }, [outcome, key, runs, outcomeKey]);

    const run = async (target: ExtensionContext) => {
        if (runs.isRunning(runKey)) return;
        // A write the user confirmed is never aborted: the backend can still finish it, so a retry could write twice.
        const controller = route.readOnly ? new AbortController() : undefined;
        readRequest.current = controller ?? null;
        runs.start(runKey, outcomeKey);
        let ok = false;
        try {
            await service.call(extension.id, route, target, controller?.signal);
            ok = true;
        } catch {
            ok = false;
        } finally {
            runs.finish(runKey, outcomeKey, controller?.signal.aborted ? undefined : { for: contextKey(target), ok });
        }
    };

    // Focus moves after the dialog is gone: while it is modal, the page is inert and focus() on the button does nothing.
    const returnFocus = useRef(false);
    useEffect(() => {
        if (pending || !returnFocus.current) return;
        returnFocus.current = false;
        button.current?.focus();
    }, [pending]);

    const closeDialog = () => {
        returnFocus.current = true;
        setPending(undefined);
    };

    const shown = outcome?.for === key ? outcome : undefined;
    return (
        <div>
            {/* aria-disabled, not disabled: a disabled button loses focus, and focus goes back to it after the dialog. */}
            <button
                ref={button}
                className={`btn btn-sm${busy ? ' btn-disabled' : ''}`}
                aria-disabled={busy}
                onClick={() => {
                    if (busy) return;
                    if (route.readOnly) run(context);
                    else setPending(context);
                }}
            >
                {contribution.title}
            </button>
            {pending && (
                <ConfirmActionDialog
                    title={contribution.title}
                    target={pending}
                    onConfirm={() => {
                        closeDialog();
                        run(pending);
                    }}
                    onCancel={closeDialog}
                />
            )}
            {shown?.ok === false && <p role="alert">Extension request failed.</p>}
            {/* Always in the page: a screen reader may not read a live region that is added with its text. */}
            <p role="status" className={`text-xs ${runningHere ? 'text-base-content/60' : 'text-success'}`}>
                {runningHere ? `${contribution.title}: running…` : shown?.ok ? `${contribution.title}: done.` : ''}
            </p>
        </div>
    );
}
