package org.finos.calm.extensions;

import java.util.Map;

/**
 * A proxied call that Hub refused or that the backend failed. The message is generic and safe to
 * return: it never holds the request path, the backend URL or the backend reply.
 */
public class ExtensionProxyException extends RuntimeException {

    private final int status;
    private final Map<String, String> headers;

    public ExtensionProxyException(int status, String message) {
        this(status, message, Map.of());
    }

    public ExtensionProxyException(int status, String message, Map<String, String> headers) {
        super(message);
        this.status = status;
        this.headers = Map.copyOf(headers);
    }

    public int status() {
        return status;
    }

    /** The headers of Hub's error reply, such as {@code Allow} on a 405. */
    public Map<String, String> headers() {
        return headers;
    }
}
