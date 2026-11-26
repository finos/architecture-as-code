import { FormEvent, KeyboardEvent, useId } from 'react';
import { IoSendOutline, IoStopCircleOutline } from 'react-icons/io5';
import { ChatContext } from '../../model/extensions.js';
import { contextLabel, MAX_MESSAGE_CHARS } from './chatSession.js';

interface ChatComposerProps {
    title: string;
    providerName: string;
    question: string;
    onQuestionChange: (text: string) => void;
    busy: boolean;
    offeredContext?: ChatContext;
    shareContext: boolean;
    onShareContext: (share: boolean) => void;
    onSend: (question: string) => void;
    onStop: () => void;
    followUp?: boolean;
}

/** The message box, the choice to share the offered resource, and Send or Stop. */
export function ChatComposer({
    title,
    providerName,
    question,
    onQuestionChange,
    busy,
    offeredContext,
    shareContext,
    onShareContext,
    onSend,
    onStop,
    followUp = false,
}: ChatComposerProps) {
    const inputId = useId();
    const shareId = useId();
    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        if (busy || !question.trim()) return;
        onSend(question);
        onQuestionChange('');
    };
    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
    };
    return (
        <form className="rounded-xl border border-base-300 bg-base-100 p-3 flex flex-col gap-3" onSubmit={submit}>
            <label htmlFor={inputId} className="sr-only">
                Message to {title}
            </label>
            <textarea
                id={inputId}
                className="textarea textarea-bordered w-full min-h-20"
                placeholder={followUp ? 'Ask a follow-up…' : 'Ask about architectures, patterns or their dependencies…'}
                maxLength={MAX_MESSAGE_CHARS}
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                onKeyDown={onKeyDown}
            />
            <div className="flex flex-wrap items-center gap-3 justify-between">
                {offeredContext ? (
                    <label htmlFor={shareId} className="flex items-start gap-2 text-sm min-w-0 flex-1 cursor-pointer">
                        <input
                            id={shareId}
                            type="checkbox"
                            className="checkbox checkbox-sm mt-0.5"
                            checked={shareContext}
                            onChange={(event) => onShareContext(event.target.checked)}
                        />
                        <span className="wrap-anywhere">
                            Share <span className="font-medium">{contextLabel(offeredContext)}</span>
                            {offeredContext.selectedElement && (
                                <>
                                    {' '}
                                    and node <span className="font-medium">{offeredContext.selectedElement}</span>
                                </>
                            )}{' '}
                            with {providerName}
                        </span>
                    </label>
                ) : (
                    <span className="text-sm text-base-content/60">
                        {followUp
                            ? 'Continue this conversation'
                            : 'No architecture is shared. Open the chat from an architecture to offer it.'}
                    </span>
                )}
                {busy ? (
                    <button type="button" className="btn btn-outline btn-sm gap-2" onClick={onStop}>
                        <IoStopCircleOutline className="h-4 w-4" aria-hidden="true" />
                        Stop
                    </button>
                ) : (
                    <button type="submit" className="btn btn-primary btn-sm gap-2" disabled={!question.trim()}>
                        <IoSendOutline className="h-4 w-4" aria-hidden="true" />
                        Send
                    </button>
                )}
            </div>
        </form>
    );
}
