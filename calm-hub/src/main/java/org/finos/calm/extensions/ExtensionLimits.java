package org.finos.calm.extensions;

import java.time.Duration;

/**
 * The limits on each proxied call to one extension backend (ADR 0011). {@code maxResponseBytes} also caps the total
 * size of a streamed reply. Streams of the generic proxy and of the chat endpoint have separate pools, and each user
 * has at most {@code maxConcurrentStreamsPerUser} streams in each pool.
 */
public record ExtensionLimits(Duration connectTimeout, Duration requestTimeout, int maxRequestBytes, int maxResponseBytes,
                              int maxConcurrentCalls, int maxConcurrentStreams, int maxConcurrentChatStreams,
                              int maxConcurrentStreamsPerUser, Duration streamIdleTimeout, Duration maxStreamDuration) {

    /** With the default stream limits. */
    public ExtensionLimits(Duration connectTimeout, Duration requestTimeout, int maxRequestBytes, int maxResponseBytes,
                           int maxConcurrentCalls) {
        this(connectTimeout, requestTimeout, maxRequestBytes, maxResponseBytes, maxConcurrentCalls, 8, 8, 2,
                Duration.ofSeconds(30), Duration.ofSeconds(300));
    }
}
