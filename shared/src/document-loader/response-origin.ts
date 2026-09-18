import { DocumentLoadError } from './document-loader.js';

/**
 * Browsers follow redirects transparently (axios's maxRedirects applies only in Node), so a request
 * to an allowed origin can end up answered by another origin. When the adapter exposes the final URL
 * (XHR `responseURL`, fetch `Response.url`), reject a response whose origin differs from the one requested.
 */
export function assertResponseOrigin(response: { request?: unknown }, expectedOrigin: string, documentId: string): void {
    const requestInfo = response.request as { responseURL?: unknown; url?: unknown } | undefined;
    const responseURL = requestInfo?.responseURL;
    const urlField = requestInfo?.url;

    const finalUrl = typeof responseURL === 'string' && responseURL.length > 0
        ? responseURL
        : typeof urlField === 'string' && urlField.length > 0
            ? urlField
            : undefined;

    if (finalUrl === undefined) {
        // Node's http adapter doesn't expose a final URL on the request — nothing to verify.
        return;
    }

    // Resolve against expectedOrigin rather than parsing finalUrl alone: a real XHR/fetch
    // responseURL is always absolute, so the base is ignored and this is equivalent to comparing
    // finalUrl's own origin; a relative value (as some test mocks/adapters produce) resolves onto
    // the requested origin instead of throwing, which is the correct "no signal" outcome.
    const finalOrigin = new URL(finalUrl, expectedOrigin).origin;

    if (finalOrigin.toLowerCase() !== expectedOrigin.toLowerCase()) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `Request for ${documentId} was redirected to a different origin (${finalOrigin}); refusing to use the response.`,
            recoverable: false
        });
    }
}
