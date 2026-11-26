import { ExtensionSummary } from '../../model/extensions.js';
import { ExtensionLogo } from '../ExtensionLogo.js';

/** Names the extension that gets the messages. The logo is decorative; the name is always visible. */
export function ChatProviderLabel({
    extension,
    prefix,
}: {
    extension: Pick<ExtensionSummary, 'id' | 'name' | 'provider' | 'logo'>;
    prefix?: string;
}) {
    return (
        <span className="inline-flex items-center gap-2 min-w-0" data-testid="chat-provider-label">
            <ExtensionLogo extension={extension} size={16} />
            <span className="min-w-0 wrap-anywhere">
                {prefix && <>{prefix} </>}
                <span className="font-medium">{extension.name || extension.id}</span>
                {extension.provider && <span className="text-base-content/60"> · {extension.provider}</span>}
            </span>
        </span>
    );
}
