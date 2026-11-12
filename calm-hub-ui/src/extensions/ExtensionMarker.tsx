import { extensionMarkerColour } from './extensionIdentity.js';

/** The colour dot that identifies an extension. Decorative: a text label always names the extension. */
export function ExtensionMarker({ extensionId, size = 8 }: { extensionId: string; size?: number }) {
    return (
        <span
            aria-hidden="true"
            data-testid="extension-marker"
            data-colour={extensionMarkerColour(extensionId)}
            className="inline-block shrink-0 rounded-full"
            style={{ width: size, height: size, backgroundColor: extensionMarkerColour(extensionId) }}
        />
    );
}
