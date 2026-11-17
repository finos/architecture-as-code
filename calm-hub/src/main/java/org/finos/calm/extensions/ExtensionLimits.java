package org.finos.calm.extensions;

import java.time.Duration;

/**
 * The limits on each proxied call to one extension backend (ADR 0011). {@code maxResponseBytes} also caps the total
 * size of a streamed reply.
 */
public record ExtensionLimits(Duration connectTimeout, Duration requestTimeout, int maxRequestBytes, int maxResponseBytes,
                              int maxConcurrentCalls, int maxConcurrentStreams, Duration streamIdleTimeout,
                              Duration maxStreamDuration) {

    /** With the default stream limits. */
    public ExtensionLimits(Duration connectTimeout, Duration requestTimeout, int maxRequestBytes, int maxResponseBytes,
                           int maxConcurrentCalls) {
        this(connectTimeout, requestTimeout, maxRequestBytes, maxResponseBytes, maxConcurrentCalls, 8,
                Duration.ofSeconds(30), Duration.ofSeconds(300));
    }
}
