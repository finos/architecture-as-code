import { MouseEventHandler, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { ChatContext, ExtensionContext } from '../../model/extensions.js';
import { ExtensionResourceContext } from '../ExtensionResourceContext.js';
import { useChatProvider } from '../ExtensionsContext.js';
import { CHAT_PATH } from '../../hub/routes.js';
import { isChatContext } from './chatSession.js';

/** The resource that a page offers to the chat. The chat page asks before it shares it. */
export function chatContextOf(context: ExtensionContext | null | undefined, selectedElement?: string | null): ChatContext | undefined {
    if (!context) return undefined;
    const value = {
        namespace: context.namespace,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        version: context.version,
        ...(selectedElement ?? context.selectedElement ? { selectedElement: selectedElement ?? context.selectedElement } : {}),
    };
    return isChatContext(value) ? value : undefined;
}

interface ChatEntryLinkProps {
    /** The context to offer. By default, the resource of the page and the node that its URL names. */
    context?: ExtensionContext | null;
    /** Only the icon, with the title as its accessible name, where there is no room for the label. */
    compact?: boolean;
    className?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * The entry point to the chat of the operator's chat provider, labelled with the title of its chat entry. Nothing when
 * the operator chose no provider. It offers the resource of the page; the user decides on the chat page to share it.
 */
export function ChatEntryLink(props: ChatEntryLinkProps) {
    const chat = useChatProvider();
    // Only with a provider: then the link is in a router, while a page with no chat can render it anywhere.
    return chat ? <EntryLink {...props} title={chat.contribution.title} /> : null;
}

function EntryLink({ context, compact, className, title, onClick }: ChatEntryLinkProps & { title: string }) {
    const pageContext = useContext(ExtensionResourceContext);
    const location = useLocation();
    const node = context === undefined ? new URLSearchParams(location.search).get('node') : undefined;
    const offered = chatContextOf(context === undefined ? pageContext : context, node);
    const onChat = location.pathname === CHAT_PATH;
    return (
        <Link
            to={CHAT_PATH}
            // On the chat page itself the link keeps the offer that the page has.
            state={onChat ? location.state : { chatContext: offered }}
            aria-current={onChat ? 'page' : undefined}
            className={className ?? `btn btn-ghost btn-sm gap-2 text-primary${compact ? ' btn-square' : ''}`}
            aria-label={compact ? title : undefined}
            title={compact ? title : undefined}
            data-testid="chat-entry-link"
            onClick={onClick}
        >
            <IoChatbubbleEllipsesOutline className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!compact && <span className="truncate">{title}</span>}
        </Link>
    );
}
