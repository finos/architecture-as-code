import { ChatContext, ChatMessage, ScreenLinkValue } from '../../model/extensions.js';
import { isDestination } from '../../navigation/destinations.js';

/** The limits that Hub checks on each chat message (ExtensionChat). */
export const MAX_MESSAGES = 100;
export const MAX_MESSAGE_CHARS = 16_000;
/** More citations than this in one reply are left out, so that one reply cannot fill the page. */
export const MAX_CITATIONS = 20;

export type ReplyStatus = 'streaming' | 'done' | 'stopped' | 'failed';

/** One question and its reply. `id` is the message id that a retry sends again; `attempt` is new for each try. */
export interface ChatTurn {
    id: string;
    attempt: string;
    question: string;
    /** The resource shared with this question, if any. */
    context?: ChatContext;
    reply: string;
    citations: ScreenLinkValue[];
    status: ReplyStatus;
    error?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value !== '' && value.length <= max;

/** A context from router state. The UI wrote it, but history state can come from anywhere, so it is checked. */
export function isChatContext(value: unknown): value is ChatContext {
    return (
        isObject(value) &&
        isText(value.namespace, 256) &&
        (value.resourceType === 'architectures' || value.resourceType === 'patterns') &&
        isText(value.resourceId, 256) &&
        isText(value.version, 128) &&
        (value.selectedElement === undefined || isText(value.selectedElement, 256))
    );
}

export const sameContext = (a?: ChatContext, b?: ChatContext) =>
    a?.namespace === b?.namespace &&
    a?.resourceType === b?.resourceType &&
    a?.resourceId === b?.resourceId &&
    a?.version === b?.version &&
    a?.selectedElement === b?.selectedElement;

/** A citation event: a label and one destination that Hub can open (`isDestination`). Anything else is left out. */
export function parseCitation(data: string): ScreenLinkValue | undefined {
    let value: unknown;
    try {
        value = JSON.parse(data);
    } catch {
        return undefined;
    }
    if (!isObject(value) || !isText(value.label, 200)) return undefined;
    const { href, hub, screen } = value;
    const destination = { href, hub, screen };
    return isDestination(destination) ? ({ label: value.label, ...destination } as ScreenLinkValue) : undefined;
}

/** The text of a `delta` event, or of the `message` of an `error` event. */
export function eventText(data: string, field: 'text' | 'message'): string | undefined {
    try {
        const value: unknown = JSON.parse(data);
        return isObject(value) && typeof value[field] === 'string' ? (value[field] as string) : undefined;
    } catch {
        return undefined;
    }
}

/**
 * The messages for the next question: each earlier question, and each reply that the user saw in full or stopped. A
 * failed reply is left out. The oldest messages go first when the conversation is longer than Hub allows.
 */
export function chatMessages(earlier: readonly ChatTurn[], question: string): ChatMessage[] {
    const messages: ChatMessage[] = earlier.flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        ...((turn.status === 'done' || turn.status === 'stopped') && turn.reply.trim() !== ''
            ? [{ role: 'assistant' as const, content: turn.reply.slice(0, MAX_MESSAGE_CHARS) }]
            : []),
    ]);
    return [...messages, { role: 'user' as const, content: question }].slice(-MAX_MESSAGES);
}

export const contextLabel = (context: ChatContext) =>
    `${context.namespace} / ${context.resourceType}/${context.resourceId} ${context.version}`;
