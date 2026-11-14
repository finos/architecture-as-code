import { extensionMarkerColour } from './extensionIdentity.js';

/** The colour dot that identifies an extension. Decorative: a text label always names the extension. */
export function ExtensionMarker({ extensionId }: { extensionId: string }) {
    const colour = extensionMarkerColour(extensionId);
    return (
        <span
            aria-hidden="true"
            data-testid="extension-marker"
            data-colour={colour}
            className="inline-block shrink-0 rounded-full"
            style={{ width: 8, height: 8, backgroundColor: colour }}
        />
    );
}
