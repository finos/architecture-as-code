package org.finos.calm.extensions;

import java.io.InputStream;

/**
 * One call to an extension route. {@code path} is the raw, percent-encoded path after
 * {@code /api/calm/extensions/<id>/api}, starting with {@code /}. {@code rawQuery} and the headers
 * can be null. {@code sourceIp} is for the audit log only, and is null unless
 * {@code calm.audit.capture-source-ip} is on. {@code body} can be null, and is read up to the
 * extension's size cap.
 */
public record ExtensionProxyRequest(
        String extensionId,
        String method,
        String path,
        String rawQuery,
        String contentType,
        String accept,
        String acceptLanguage,
        String ifMatch,
        String ifNoneMatch,
        String sourceIp,
        InputStream body
) {

    /** A call with no conditional headers and no source IP. */
    public ExtensionProxyRequest(String extensionId, String method, String path, String rawQuery, String contentType,
                                 String accept, String acceptLanguage, InputStream body) {
        this(extensionId, method, path, rawQuery, contentType, accept, acceptLanguage, null, null, null, body);
    }
}
