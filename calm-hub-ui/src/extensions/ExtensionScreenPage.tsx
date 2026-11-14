import { useParams } from 'react-router-dom';
import { useExtensions, useExtensionsStatus } from './ExtensionsContext.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { ExtensionSlot, SlotFrame } from './ExtensionSlot.js';

function ScreenBody() {
    const { extensionId, contributionId } = useParams();
    const status = useExtensionsStatus();
    const extension = useExtensions().find((entry) => entry.id === extensionId);
    const contribution = extension?.contributes.screen?.find((entry) => entry.id === contributionId);
    const state =
        status === 'loading' ? (
            <p role="status">Loading extension…</p>
        ) : status === 'signed-out' ? (
            <p role="alert">Sign in to see extensions.</p>
        ) : status === 'failed' ? (
            <p role="alert">Extensions could not be loaded.</p>
        ) : !extension || !contribution ? (
            <p>Extension screen unavailable.</p>
        ) : undefined;
    if (state || !extension || !contribution) {
        // The same named region as the slot, so a failed or unknown screen has the outline of a loaded one.
        return (
            <SlotFrame title={contribution?.title ?? 'Extension screen'} level={1}>
                {state}
            </SlotFrame>
        );
    }
    return <ExtensionSlot extension={extension} contribution={contribution} headingLevel={1} />;
}

export function ExtensionScreenPage() {
    return (
        <>
            <Navbar />
            <main className="p-6">
                <ScreenBody />
            </main>
        </>
    );
}
