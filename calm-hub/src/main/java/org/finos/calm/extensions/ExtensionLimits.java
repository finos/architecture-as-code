package org.finos.calm.extensions;

import java.time.Duration;

/** The limits on each proxied call to one extension backend (ADR 0011). */
public record ExtensionLimits(Duration connectTimeout, Duration requestTimeout, int maxRequestBytes, int maxResponseBytes,
                              int maxConcurrentCalls) {}
