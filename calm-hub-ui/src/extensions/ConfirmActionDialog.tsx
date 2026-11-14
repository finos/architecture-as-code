import { useEffect, useId, useRef } from 'react';
import { ExtensionContext } from '../model/extensions.js';

interface ConfirmActionDialogProps {
    title: string;
    /** The context the action will send: the dialog names it, because the page can change while the dialog is open. */
    target: ExtensionContext;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmActionDialog({ title, target, onConfirm, onCancel }: ConfirmActionDialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const cancel = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || dialog.open) return;
        // showModal gives Escape and a focus trap. jsdom does not have it.
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        // showModal focuses Run, the first button, so an Enter would confirm a write.
        cancel.current?.focus();
    }, []);

    // close() first: while the dialog is modal the page is inert, so the caller cannot move focus out of it.
    const closeThen = (next: () => void) => {
        const dialog = ref.current;
        if (dialog?.open && typeof dialog.close === 'function') dialog.close();
        next();
    };

    const rows = [
        ['Namespace', target.namespace],
        ['Resource', target.resource],
        ['Version', target.version],
        ['Element', target.selectedElement],
    ].filter((row): row is [string, string] => !!row[1]);

    return (
        <dialog
            ref={ref}
            className="modal"
            aria-labelledby={headingId}
            onCancel={(event) => {
                event.preventDefault();
                closeThen(onCancel);
            }}
        >
            <div className="modal-box">
                <h3 id={headingId} className="font-bold text-lg">
                    Confirm action
                </h3>
                <p className="pt-4">Run {title}?</p>
                {rows.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-4 text-sm" aria-label="Target">
                        {rows.map(([label, value]) => (
                            <div key={label} className="contents">
                                <dt className="text-base-content/60">{label}</dt>
                                <dd className="font-mono break-all">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
                <div className="modal-action">
                    <button type="button" className="btn btn-primary" onClick={() => closeThen(onConfirm)}>
                        Run
                    </button>
                    <button ref={cancel} type="button" className="btn btn-ghost" onClick={() => closeThen(onCancel)}>
                        Cancel
                    </button>
                </div>
            </div>
            <div className="modal-backdrop">
                <button type="button" onClick={() => closeThen(onCancel)}>
                    close
                </button>
            </div>
        </dialog>
    );
}
