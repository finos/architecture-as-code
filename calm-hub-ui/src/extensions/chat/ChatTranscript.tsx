import { ExtensionSummary } from '../../model/extensions.js';
import { MarkdownBlock } from '../blocks/MarkdownBlock.js';
import { ScreenLink } from '../ScreenLink.js';
import { ChatProviderLabel } from './ChatProviderLabel.js';
import { ChatTurn, contextLabel } from './chatSession.js';
import { ChatAnswerText } from './ChatAnswerText.js';

interface ChatTranscriptProps {
    turns: ChatTurn[];
    extension: Pick<ExtensionSummary, 'id' | 'name' | 'provider' | 'logo'>;
    onRetry: () => void;
    /** Search already names the first question and the provider above the answer. */
    searchAnswer?: boolean;
}

function ReplyStatus({ turn, last, onRetry }: { turn: ChatTurn; last: boolean; onRetry: () => void }) {
    if (turn.status === 'streaming') {
        return (
            <p className="text-sm text-base-content/60 flex items-center gap-2">
                <span className="loading loading-dots loading-xs" aria-hidden="true" />
                Replying…
            </p>
        );
    }
    if (turn.status === 'done') return null;
    const text = turn.status === 'stopped' ? 'You stopped this reply.' : `The reply failed: ${turn.error ?? 'unknown error'}`;
    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
                role={turn.status === 'failed' ? 'alert' : undefined}
                className={turn.status === 'failed' ? 'text-error' : 'text-base-content/70'}
            >
                {text}
            </span>
            {last && (
                <button type="button" className="btn btn-xs btn-outline" onClick={onRetry}>
                    Retry
                </button>
            )}
        </div>
    );
}

/** The questions and replies. A reply shows while it arrives; a stopped or failed reply keeps the part that came. */
export function ChatTranscript({ turns, extension, onRetry, searchAnswer = false }: ChatTranscriptProps) {
    return (
        <ol className="flex flex-col gap-4 list-none p-0 m-0" aria-label="Conversation">
            {turns.map((turn, index) => (
                <li key={turn.id} className="flex flex-col gap-3">
                    {(!searchAnswer || index > 0) && (
                        <div className="self-end max-w-[85%] rounded-2xl bg-primary/10 px-4 py-2" data-testid="chat-question">
                            <p className="whitespace-pre-wrap wrap-anywhere m-0">{turn.question}</p>
                            {turn.context && (
                                <p className="text-xs text-base-content/60 mt-1 mb-0 wrap-anywhere">
                                    Shared: {contextLabel(turn.context)}
                                    {turn.context.selectedElement && <> · {turn.context.selectedElement}</>}
                                </p>
                            )}
                        </div>
                    )}
                    <article
                        className={
                            searchAnswer
                                ? 'min-w-0 flex flex-col gap-2'
                                : 'rounded-xl border border-base-300 bg-base-100 px-4 py-3 flex flex-col gap-2'
                        }
                        aria-busy={turn.status === 'streaming'}
                        data-testid="chat-reply"
                        data-status={turn.status}
                    >
                        {!searchAnswer && (
                            <p className="text-xs m-0 text-base-content/70">
                                <ChatProviderLabel extension={extension} />
                            </p>
                        )}
                        {turn.reply &&
                            (searchAnswer ? <ChatAnswerText text={turn.reply} /> : <MarkdownBlock text={turn.reply} headingLevel={2} />)}
                        {turn.citations.length > 0 && (
                            <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Sources">
                                {turn.citations.map((citation, at) => (
                                    <li key={at}>
                                        <ScreenLink link={citation} className="btn btn-sm btn-outline normal-case" />
                                    </li>
                                ))}
                            </ul>
                        )}
                        <ReplyStatus turn={turn} last={index === turns.length - 1} onRetry={onRetry} />
                    </article>
                </li>
            ))}
        </ol>
    );
}
