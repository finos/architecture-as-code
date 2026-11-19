package org.finos.calm.domain.extensions;

import io.quarkus.runtime.annotations.RegisterForReflection;

/** The chat entry that the operator chose for Hub UI: an extension id and the id of one of its {@code chat} entries. */
@RegisterForReflection
public record ChatProvider(String extension, String contribution) {}
