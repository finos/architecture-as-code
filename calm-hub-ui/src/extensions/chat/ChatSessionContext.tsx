import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChatContext } from '../../model/extensions.js';
import { ChatCallError } from '../../service/extension-service.js';
import { useChatProvider, useExtensionService } from '../ExtensionsContext.js';
import { ChatTurn, chatMessages, eventText, MAX_CITATIONS, parseCitation, sameContext } from './chatSession.js';

export interface ChatSession {
    turns: ChatTurn[];
    draft: string;
    setDraft: (text: string) => void;
    /** The resource that the page the user came from offers to share. It goes only with a question that shares it. */
    offeredContext?: ChatContext;
    shareContext: boolean;
    busy: boolean;
    send: (question: string) => void;
    stop: () => void;
    /** Sends the last question again with the same message id, so the transcript shows it once. */
    retry: () => void;
    newConversation: () => void;
    /** Explicit submissions start fresh. An initial URL may start only before any conversation or provider change. */
    startSearch: (query: string, options?: { initial: boolean }) => void;
    searchQuery?: string;
    offerContext: (context: ChatContext | undefined) => void;
    setShareContext: (share: boolean) => void;
}

const ChatSessionContext = createContext<ChatSession | null>(null);

const newId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * The conversation with the operator's chat provider. It lives above the router, in memory only, so it stays while the
 * user opens a cited architecture and comes back, and goes on a reload or with New conversation.
 */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
    const service = useExtensionService();
    const provider = useChatProvider();
    const conversationId = useRef(newId());
    const searchQueryRef = useRef<string | undefined>(undefined);
    const initialSearchAllowed = useRef(true);
    const [searchQuery, setSearchQuery] = useState<string>();
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [draft, setDraft] = useState('');
    const [offeredContext, setOfferedContext] = useState<ChatContext>();
    const [shareContext, setShareContext] = useState(false);
    const inFlight = useRef<{ attempt: string; controller: AbortController } | null>(null);
    // The latest values for the actions, so that a second click before a render cannot send twice.
    const turnsRef = useRef(turns);
    const offeredRef = useRef(offeredContext);
    useLayoutEffect(() => {
        turnsRef.current = turns;
        offeredRef.current = offeredContext;
    });

    // Only the attempt that is streaming now changes its turn. A retry keeps the message id, so an event that an earlier
    // attempt still delivers must not reach the new reply.
    const update = useCallback((attempt: string, change: (turn: ChatTurn) => ChatTurn) => {
        setTurns((current) => current.map((turn) => (turn.attempt === attempt && turn.status === 'streaming' ? change(turn) : turn)));
    }, []);

    const run = useCallback(
        (turn: ChatTurn, earlier: ChatTurn[]) => {
            if (!provider) return;
            const controller = new AbortController();
            const flight = { attempt: turn.attempt, controller };
            inFlight.current = flight;
            // A terminal event ends the request, so the stream does not stay open and hold a stream slot in Hub.
            const finish = (change: (t: ChatTurn) => ChatTurn) => {
                update(turn.attempt, change);
                controller.abort();
            };
            const request = {
                conversationId: conversationId.current,
                messageId: turn.id,
                messages: chatMessages(earlier, turn.question),
                ...(turn.context ? { context: turn.context } : {}),
            };
            service
                .sendChatMessage(
                    provider.extension,
                    provider.contribution.id,
                    request,
                    (event) => {
                        if (controller.signal.aborted) return;
                        if (event.name === 'delta') {
                            const text = eventText(event.data, 'text');
                            if (text) update(turn.attempt, (t) => ({ ...t, reply: t.reply + text }));
                        } else if (event.name === 'citation') {
                            const citation = parseCitation(event.data);
                            if (citation)
                                update(turn.attempt, (t) =>
                                    t.citations.length >= MAX_CITATIONS ||
                                    t.citations.some((c) => JSON.stringify(c) === JSON.stringify(citation))
                                        ? t
                                        : { ...t, citations: [...t.citations, citation] }
                                );
                        } else if (event.name === 'done') {
                            finish((t) => ({ ...t, status: 'done' }));
                        } else if (event.name === 'error') {
                            const message = eventText(event.data, 'message') ?? 'The chat provider failed';
                            finish((t) => ({ ...t, status: 'failed', error: message }));
                        }
                    },
                    controller.signal
                )
                .then(() => update(turn.attempt, (t) => ({ ...t, status: 'failed', error: 'The reply ended before it was complete' })))
                .catch((error: unknown) => {
                    if (controller.signal.aborted) {
                        update(turn.attempt, (t) => ({ ...t, status: 'stopped' }));
                    } else {
                        const message = error instanceof ChatCallError ? error.message : 'The reply could not be read';
                        update(turn.attempt, (t) => ({ ...t, status: 'failed', error: message }));
                    }
                })
                .finally(() => {
                    if (inFlight.current === flight) inFlight.current = null;
                });
        },
        [provider, service, update]
    );

    const busy = turns.some((turn) => turn.status === 'streaming');

    const send = useCallback(
        (question: string) => {
            const text = question.trim();
            if (!text || turnsRef.current.some((turn) => turn.status === 'streaming')) return;
            initialSearchAllowed.current = false;
            const turn: ChatTurn = {
                id: newId(),
                attempt: newId(),
                question: text,
                ...(shareContext && offeredContext ? { context: offeredContext } : {}),
                reply: '',
                citations: [],
                status: 'streaming',
            };
            const earlier = turnsRef.current;
            turnsRef.current = [...earlier, turn];
            setTurns(turnsRef.current);
            run(turn, earlier);
        },
        [shareContext, offeredContext, run]
    );

    const retry = useCallback(() => {
        const current = turnsRef.current;
        const last = current[current.length - 1];
        if (!last || (last.status !== 'failed' && last.status !== 'stopped')) return;
        const again: ChatTurn = { ...last, attempt: newId(), reply: '', citations: [], status: 'streaming', error: undefined };
        turnsRef.current = [...current.slice(0, -1), again];
        setTurns(turnsRef.current);
        run(again, current.slice(0, -1));
    }, [run]);

    // Stop ends the reply at once, also while its request still waits for sign-in. A later callback of that attempt
    // changes nothing, because update() changes only a streaming turn of its attempt.
    const stop = useCallback(() => {
        const flight = inFlight.current;
        if (!flight) return;
        inFlight.current = null;
        update(flight.attempt, (t) => ({ ...t, status: 'stopped' }));
        flight.controller.abort();
    }, [update]);

    const newConversation = useCallback(() => {
        initialSearchAllowed.current = false;
        inFlight.current?.controller.abort();
        inFlight.current = null;
        turnsRef.current = [];
        setTurns([]);
        setDraft('');
        conversationId.current = newId();
        searchQueryRef.current = undefined;
        setSearchQuery(undefined);
        setShareContext(false);
    }, []);

    const startSearch = useCallback(
        (query: string, options?: { initial: boolean }) => {
            const text = query.trim();
            if (!provider || !text) return;
            if (options?.initial && searchQueryRef.current !== text && (!initialSearchAllowed.current || draft)) return;
            offeredRef.current = undefined;
            setOfferedContext(undefined);
            setShareContext(false);
            if (options?.initial && searchQueryRef.current === text) return;
            newConversation();
            searchQueryRef.current = text;
            setSearchQuery(text);
            // A search sends only its query, never a previous conversation or an architecture offer.
            const turn: ChatTurn = { id: newId(), attempt: newId(), question: text, reply: '', citations: [], status: 'streaming' };
            turnsRef.current = [turn];
            setTurns([turn]);
            run(turn, []);
        },
        [provider, newConversation, run, draft]
    );

    // A new page offers another context: the user must choose again to share it.
    const offerContext = useCallback((context: ChatContext | undefined) => {
        if (sameContext(offeredRef.current, context)) return;
        offeredRef.current = context;
        setOfferedContext(context);
        setShareContext(false);
    }, []);

    // Another provider, after an operator change and a registry reload, starts a new conversation. The user must
    // choose again to share a resource with it.
    const providerKey = provider ? `${provider.extension}/${provider.contribution.id}` : undefined;
    const previousProvider = useRef(providerKey);
    const [sessionProvider, setSessionProvider] = useState(providerKey);
    if (sessionProvider !== providerKey) {
        setSessionProvider(providerKey);
        if (sessionProvider !== undefined) {
            setTurns([]);
            setDraft('');
            setSearchQuery(undefined);
            setShareContext(false);
        }
    }

    useLayoutEffect(() => {
        if (previousProvider.current !== undefined && previousProvider.current !== providerKey) initialSearchAllowed.current = false;
        previousProvider.current = providerKey;
        conversationId.current = newId();
        searchQueryRef.current = undefined;
    }, [providerKey]);

    // A reply of the earlier provider stops with its conversation, and every reply stops on unmount.
    useEffect(() => {
        const flight = inFlight;
        return () => {
            flight.current?.controller.abort();
            flight.current = null;
        };
    }, [providerKey]);

    const value = useMemo(
        (): ChatSession => ({
            turns,
            draft,
            setDraft,
            offeredContext,
            shareContext,
            busy,
            send,
            stop,
            retry,
            newConversation,
            startSearch,
            searchQuery,
            offerContext,
            setShareContext,
        }),
        [turns, draft, offeredContext, shareContext, busy, send, stop, retry, newConversation, startSearch, searchQuery, offerContext]
    );
    return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSession {
    const session = useContext(ChatSessionContext);
    if (!session) throw new Error('useChatSession needs a ChatSessionProvider');
    return session;
}

export function useOptionalChatSession(): ChatSession | null {
    return useContext(ChatSessionContext);
}
