import { useChatProvider, useExtensions } from '../ExtensionsContext.js';

/** Disclosure before submission, not an action that sends a question on focus or typing. */
export function SearchChatEntry({ id }: { id?: string }) {
    const chat = useChatProvider();
    const extension = useExtensions().find((entry) => entry.id === chat?.extension);
    if (!extension) return null;
    return (
        <p id={id} className="text-xs text-base-content/60 px-3 py-2 m-0">
            Search also asks {extension.name || extension.id}. Only your query is shared. Provider charges and retention policies apply.
        </p>
    );
}
