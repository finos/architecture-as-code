package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.Optional;

/**
 * Operator settings for CALM Hub extensions. {@code ExtensionRegistry} checks them at startup.
 */
@ConfigMapping(prefix = "calm.extensions")
public interface ExtensionsConfig {

    /** Holds one folder for each extension, with an {@code extension.json} manifest in it. */
    Optional<String> dir();

    Identity identity();

    Http http();

    interface Identity {
        /** PKCS#8 PEM file with the RSA key that signs the identity that Hub sends to an extension. */
        Optional<String> privateKeyLocation();

        @WithDefault("calm-hub")
        String issuer();

        @WithDefault("60")
        int ttlSeconds();
    }

    interface Http {
        @WithDefault("5")
        int connectTimeout();

        @WithDefault("10")
        int requestTimeout();

        @WithDefault("1048576")
        int maxResponseBytes();
    }
}
