import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useExtensions, useExtensionsStatus } from './ExtensionsContext.js';
import { AppLayout } from '../components/navigation/AppLayout.js';
import { ExtensionSlot, SlotFrame } from './ExtensionSlot.js';
import { ScreenResourceLine } from './ScreenResourceLine.js';
import { readScreenQuery, resourceContext } from '../navigation/destinations.js';
import { ReturnLink } from '../navigation/ReturnLink.js';
import { ReturnPointProvider } from '../navigation/ReturnPointProvider.js';
import { ExtensionLogo } from './ExtensionLogo.js';
import { UrlTableState } from './blocks/BlockScope.js';

function ScreenBody() {
    const { extensionId = '', contributionId = '' } = useParams();
    const [searchParams] = useSearchParams();
    const status = useExtensionsStatus();
    const extension = useExtensions().find((entry) => entry.id === extensionId);
    const contribution = extension?.contributes.screen?.find((entry) => entry.id === contributionId);
    // Table filters (#3801) change the query too. They are not part of the screen query, so a change does not load the screen again.
    const screenQueryKey = JSON.stringify(readScreenQuery(searchParams));
    const screenQuery = useMemo(() => JSON.parse(screenQueryKey) as ReturnType<typeof readScreenQuery>, [screenQueryKey]);
    const target = screenQuery.context;
    const context = useMemo(() => (target ? resourceContext(target) : undefined), [target]);
    const title = contribution?.title ?? 'Extension screen';
    const state =
        status === 'loading' ? (
            <p role="status">Loading extension…</p>
        ) : status === 'signed-out' ? (
            <p role="alert">Sign in to see extensions.</p>
        ) : status === 'failed' ? (
            <p role="alert">Extensions could not be loaded.</p>
        ) : !extension || !contribution ? (
            <>
                <p>Extension screen unavailable.</p>
                <p className="text-sm text-base-content/70">
                    The extension &quot;{extensionId}&quot; is not enabled in this Hub, or it has no screen &quot;{contributionId}&quot;.
                </p>
            </>
        ) : screenQuery.problem ? (
            <p role="alert">{screenQuery.problem}</p>
        ) : undefined;
    return (
        <ReturnPointProvider page={{ kind: 'screen', extension: extensionId, screen: contributionId }} label={title}>
            <div className="flex flex-col gap-4 min-w-0">
                <ReturnLink className="self-start max-w-full" />
                {target && <ScreenResourceLine target={target} />}
                {state || !extension || !contribution ? (
                    // The same named region as the slot, so a failed or unknown screen has the outline of a loaded one.
                    <SlotFrame title={title} level={1}>
                        {state}
                    </SlotFrame>
                ) : (
                    <div className="min-w-0">
                        <p data-testid="extension-screen-owner" className="flex items-center gap-2 min-w-0 mb-2 text-sm font-medium text-base-content/70">
                            <ExtensionLogo extension={extension} size={20} />
                            <span className="min-w-0 truncate" title={extension.name}>
                                {extension.name}
                            </span>
                        </p>
                        <UrlTableState>
                            <ExtensionSlot extension={extension} contribution={contribution} context={context} query={screenQuery.params} headingLevel={1} point="screen" />
                        </UrlTableState>
                    </div>
                )}
            </div>
        </ReturnPointProvider>
    );
}

export function ExtensionScreenPage() {
    return (
        <AppLayout>
            <main className="flex-1 overflow-auto p-6">
                <ScreenBody />
            </main>
        </AppLayout>
    );
}
