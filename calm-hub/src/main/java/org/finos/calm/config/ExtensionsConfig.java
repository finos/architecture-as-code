package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithParentName;

import java.util.Map;
import java.util.Optional;

/**
 * Static settings for CALM Hub extensions (ADR 0012).
 */
@ConfigMapping(prefix = "calm.extensions")
public interface ExtensionsConfig {

    /** Holds one folder for each extension, with an {@code extension.json} in it. */
    Optional<String> dir();

    /**
     * The settings of each extension, {@code calm.extensions."<id>".*}. This map only declares the
     * keys, so that SmallRye does not reject them as unknown. {@code ExtensionRegistry} reads them by
     * full name, because SmallRye cannot map an environment variable to a map key with a dash.
     */
    @WithParentName
    Map<String, Extension> extensions();

    /** Strings, so that {@code ExtensionRegistry} does the checks and names the bad setting. */
    interface Extension {
        Optional<String> enabled();

        Optional<String> order();

        Optional<String> backendUrl();
    }
}
