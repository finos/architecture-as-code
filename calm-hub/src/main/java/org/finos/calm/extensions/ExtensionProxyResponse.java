package org.finos.calm.extensions;

import java.util.Map;

/**
 * The backend reply, with only the headers that Hub may pass on (ADR 0011). {@code stream} is set, and {@code body} is
 * empty, for an event stream that Hub passes on while it arrives.
 */
public record ExtensionProxyResponse(int status, Map<String, String> headers, byte[] body, ExtensionEventStream stream) {

    /** A buffered reply. */
    public ExtensionProxyResponse(int status, Map<String, String> headers, byte[] body) {
        this(status, headers, body, null);
    }
}
