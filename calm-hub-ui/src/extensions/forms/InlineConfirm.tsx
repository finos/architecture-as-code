interface InlineConfirmProps {
    question: string;
    /** More about what the step loses, after the question. */
    detail?: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/** A question in the page for a step that loses something. The safe answer takes the focus. */
export function InlineConfirm({ question, detail, confirmLabel, cancelLabel, onConfirm, onCancel }: InlineConfirmProps) {
    return (
        <span className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={question}>
            <span>
                {question}
                {detail && ` ${detail}`}
            </span>
            <button type="button" className="btn btn-sm btn-error" onClick={onConfirm}>
                {confirmLabel}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" autoFocus onClick={onCancel}>
                {cancelLabel}
            </button>
        </span>
    );
}
