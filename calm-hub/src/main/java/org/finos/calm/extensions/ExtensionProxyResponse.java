package org.finos.calm.extensions;

import java.util.Map;

/** The backend reply, with only the headers that Hub may pass on (ADR 0011). */
public record ExtensionProxyResponse(int status, Map<String, String> headers, byte[] body) {}
