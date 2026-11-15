package org.finos.calm.domain.conventions;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.json.JsonObject;

/**
 * The default convention that applies to a namespace, with its content.
 *
 * @param namespace the namespace that sets the default: the requested namespace or its nearest ancestor
 * @param inherited true when {@code namespace} is an ancestor of the requested namespace
 */
@RegisterForReflection
public record ResolvedConventionDefault(String conventionType, String namespace, int conventionId, String version,
                                    boolean inherited, JsonObject convention) {
}
