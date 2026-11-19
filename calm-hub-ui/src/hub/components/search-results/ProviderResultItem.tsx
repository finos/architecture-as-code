import { ExtensionLogo } from '../../../extensions/ExtensionLogo.js';
import type { ExtensionSummary } from '../../../model/extensions.js';
import type { ExtensionSearchResult } from '../../../model/search.js';
import { DestinationLink } from '../../../navigation/DestinationLink.js';
import { colors } from '../../../theme/colors.js';

/**
 * One provider result. The title is the link, and the link covers the card, so the card has one tab stop. The chips
 * wrap below the text on a narrow card, so a long namespace cannot widen the page.
 */
export function ProviderResultItem({ result, extension }: { result: ExtensionSearchResult; extension: ExtensionSummary }) {
    const title = (
        <span className="font-medium wrap-anywhere" style={{ color: colors.redesign.ink }}>
            {result.title}
        </span>
    );
    return (
        <li
            className="relative rounded-xl px-4 py-3 hover:bg-base-200 transition-colors focus-within:outline-2 focus-within:outline-primary"
            style={{ border: `1px solid ${colors.redesign.border}` }}
        >
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <div className="min-w-0 flex-1 basis-48">
                    {result.link ? (
                        <DestinationLink destination={result.link} className="after:absolute after:inset-0 outline-none">
                            {title}
                        </DestinationLink>
                    ) : (
                        title
                    )}
                    {result.summary && (
                        <div className="text-sm mt-1 wrap-anywhere" style={{ color: colors.redesign.muted }}>
                            {result.summary}
                        </div>
                    )}
                </div>
                <div className="ml-auto min-w-0 max-w-full flex flex-col items-end gap-1">
                    <span
                        data-testid="result-extension-chip"
                        className="flex items-center gap-1.5 text-[11px] rounded-[6px] px-1.5 py-0.5 max-w-[12rem]"
                        style={{ backgroundColor: colors.redesign.badgeBg, color: colors.redesign.mutedAlt }}
                    >
                        <ExtensionLogo extension={extension} />
                        <span className="truncate" title={extension.name}>
                            {extension.name}
                        </span>
                    </span>
                    {result.namespace && (
                        <span
                            data-testid="result-namespace-chip"
                            className="max-w-full wrap-anywhere text-right font-mono-jb text-[10px] rounded-[6px] px-1.5 py-0.5"
                            style={{ backgroundColor: colors.redesign.badgeBg, color: colors.redesign.mutedAlt }}
                        >
                            {result.namespace}
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}
