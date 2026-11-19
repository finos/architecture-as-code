import { useEffect, useId } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { useChatProvider, useExtensions } from '../ExtensionsContext.js';
import { ChatComposer } from './ChatComposer.js';
import { ChatProviderLabel } from './ChatProviderLabel.js';
import { useChatSession } from './ChatSessionContext.js';
import { ChatTranscript } from './ChatTranscript.js';

/** No provider means ordinary search, with no empty assistant panel. */
export function SearchAnswer({ query }: { query: string }) {
    const chat = useChatProvider();
    return query && chat ? <Answer key={query} query={query} /> : null;
}

function Answer({ query }: { query: string }) {
    const chat = useChatProvider()!;
    const extension = useExtensions().find((entry) => entry.id === chat.extension)!;
    const session = useChatSession();
    const { startSearch, searchQuery } = session;
    const heading = useId();
    useEffect(() => {
        // Start after the effect setup/cleanup cycle, so StrictMode does not send and abort a duplicate request.
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) startSearch(query, { initial: true });
        });
        return () => {
            cancelled = true;
        };
    }, [query, startSearch, searchQuery]);
    const current = searchQuery === query;
    const status = current ? session.turns.at(-1)?.status : undefined;
    const name = extension.name || extension.id;
    return (
        <section
            aria-labelledby={heading}
            className="rounded-3xl border border-primary/25 border-t-4 border-t-primary bg-primary/5 p-5 sm:p-7 shadow-sm min-w-0 flex flex-col gap-4"
        >
            <header className="flex items-start gap-3">
                <span className="rounded-2xl bg-primary text-primary-content p-3 shrink-0" aria-hidden="true">
                    <IoChatbubbleEllipsesOutline className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                    <h2 id={heading} className="text-2xl font-bold m-0">
                        Assistant answer
                    </h2>
                    <p className="text-sm text-base-content/70 mt-1 mb-0">
                        <ChatProviderLabel extension={extension} prefix="From" />
                    </p>
                </div>
            </header>
            <div className="sr-only" role="status">
                {status === 'streaming'
                    ? `${name} is replying`
                    : status === 'done'
                      ? 'Reply complete'
                      : status === 'stopped'
                        ? 'Reply stopped'
                        : ''}
            </div>
            {current && <ChatTranscript turns={session.turns} extension={extension} onRetry={session.retry} searchAnswer />}
            {!current && (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-sm m-0">Ask about this search to start a new conversation.</p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => startSearch(query)}>
                        Ask {name}
                    </button>
                </div>
            )}
            {current && (
                <ChatComposer
                    title={chat.contribution.title}
                    providerName={name}
                    question={session.draft}
                    onQuestionChange={session.setDraft}
                    busy={session.busy}
                    shareContext={false}
                    onShareContext={session.setShareContext}
                    onSend={session.send}
                    onStop={session.stop}
                    followUp
                />
            )}
            <p className="text-xs text-base-content/60 m-0">
                {current ? 'Your query is sent to' : 'Asking sends your query to'} {name}; no architecture is shared. Provider charges and
                retention policies apply. Answers may be AI-generated. Check the sources.
            </p>
        </section>
    );
}
