import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppLayout } from '../../components/navigation/AppLayout.js';
import { ReturnPointProvider } from '../../navigation/ReturnPointProvider.js';
import { useChatProvider, useExtensions, useExtensionsStatus } from '../ExtensionsContext.js';
import { ChatComposer } from './ChatComposer.js';
import { ChatProviderLabel } from './ChatProviderLabel.js';
import { useChatSession } from './ChatSessionContext.js';
import { ChatTranscript } from './ChatTranscript.js';
import { isChatContext } from './chatSession.js';

/** The page state that a chat entry point sets: the resource that the page offers, or none. */
function offeredByEntry(state: unknown) {
    if (typeof state !== 'object' || state === null || !('chatContext' in state)) return { set: false } as const;
    const context = (state as { chatContext?: unknown }).chatContext;
    return { set: true, context: isChatContext(context) ? context : undefined } as const;
}

function ChatBody() {
    const status = useExtensionsStatus();
    const chat = useChatProvider();
    const extension = useExtensions().find((entry) => entry.id === chat?.extension);
    const session = useChatSession();
    const location = useLocation();
    const { offerContext } = session;

    // An entry point names the resource of the page it is on. Browser Back to the chat keeps the state of that entry.
    const offer = offeredByEntry(location.state);
    const offeredKey = offer.set ? JSON.stringify(offer.context ?? null) : undefined;
    useEffect(() => {
        if (offeredKey !== undefined) offerContext(JSON.parse(offeredKey) ?? undefined);
    }, [offeredKey, offerContext]);

    const state =
        status === 'loading' ? (
            <p role="status">Loading chat…</p>
        ) : status === 'signed-out' ? (
            <p role="alert">Sign in to use the chat.</p>
        ) : status === 'failed' ? (
            <p role="alert">Extensions could not be loaded, so the chat is not available.</p>
        ) : !chat || !extension ? (
            <p>The operator has not chosen a chat provider for this CALM Hub.</p>
        ) : undefined;
    if (state || !chat || !extension) {
        return (
            <section aria-labelledby="chat-heading" className="flex flex-col gap-3">
                <h1 id="chat-heading" className="text-2xl font-bold">
                    Chat
                </h1>
                {state}
            </section>
        );
    }
    const name = extension.name || extension.id;
    // The state of the reply, never its text, so a screen reader does not read each word. A failure has its own alert.
    const replyState = session.turns.at(-1)?.status;
    const announcement =
        replyState === 'streaming'
            ? `${name} is replying`
            : replyState === 'done'
              ? 'Reply complete'
              : replyState === 'stopped'
                ? 'Reply stopped'
                : '';
    return (
        // A citation records the chat as its return point. The conversation is above the router, so "Back to" finds it.
        <ReturnPointProvider page={{ kind: 'chat' }} label={chat.contribution.title}>
            <section aria-labelledby="chat-heading" className="flex flex-col gap-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                        <h1 id="chat-heading" className="text-2xl font-bold wrap-anywhere">
                            {chat.contribution.title}
                        </h1>
                        <p className="text-sm text-base-content/70 m-0">
                            <ChatProviderLabel extension={extension} prefix="Messages go to" />
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={session.newConversation}
                        disabled={session.turns.length === 0 && !session.draft}
                    >
                        New conversation
                    </button>
                </header>
                {session.turns.length > 0 && <ChatTranscript turns={session.turns} extension={extension} onRetry={session.retry} />}
                <div className="sr-only" role="status" aria-live="polite">
                    {announcement}
                </div>
                <ChatComposer
                    title={chat.contribution.title}
                    providerName={name}
                    question={session.draft}
                    onQuestionChange={session.setDraft}
                    busy={session.busy}
                    offeredContext={session.offeredContext}
                    shareContext={session.shareContext}
                    onShareContext={session.setShareContext}
                    onSend={session.send}
                    onStop={session.stop}
                />
                <p className="text-xs text-base-content/60 m-0">
                    CALM Hub sends {name} your messages in this conversation and only the architecture that you choose to share. The
                    conversation stays in this browser tab until you start a new one or reload the page. {name} may keep messages under its
                    own retention policy.
                </p>
            </section>
        </ReturnPointProvider>
    );
}

/** The top-level chat with the operator's chat provider, at `/chat`. */
export function ChatPage() {
    return (
        <AppLayout>
            <main className="flex-1 overflow-auto p-4 sm:p-6 w-full max-w-4xl mx-auto">
                <ChatBody />
            </main>
        </AppLayout>
    );
}
