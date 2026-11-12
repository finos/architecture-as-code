package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

/**
 * Operator settings for personal namespaces. See {@code PERSONAL_NAMESPACES.md}.
 */
@ConfigMapping(prefix = "calm.namespaces.personal")
public interface PersonalNamespacesConfig {

    @WithDefault("false")
    boolean enabled();

    @WithDefault("users")
    String root();

    /** Whether a new personal namespace gets the starter {@code my-architecture}. */
    @WithDefault("true")
    boolean starterArchitecture();
}
