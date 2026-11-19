package org.finos.calm.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithParentName;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Static settings for CALM Hub extensions (ADR 0012).
 */
@ConfigMapping(prefix = "calm.extensions")
public interface ExtensionsConfig {

    /**
     * Allows enabled extensions with routes when {@code calm.auth.enabled} is false. Only for local
     * development: every caller is then a global admin.
     */
    @WithDefault("false")
    boolean allowWithoutAuth();

    /** Holds one folder for each extension, with an {@code extension.json} in it. */
    Optional<String> dir();

    /**
     * The chat that Hub UI shows: {@code <extension-id>}, or {@code <extension-id>/<chat-entry-id>} for an extension
     * with more than one chat entry. Hub never picks one itself.
     */
    Optional<String> chatProvider();

    /**
     * The settings of each extension, {@code calm.extensions."<id>".*}. This map only declares the
     * keys, so that SmallRye does not reject them as unknown. {@code ExtensionRegistry} reads them by
     * full name, because SmallRye cannot map an environment variable to a map key with a dash.
     */
    @WithParentName
    Map<String, Extension> extensions();

    /** The keys that sign the identity assertion that Hub sends to an extension (ADR 0010). */
    Identity identity();

    /** The default limits on each call to an extension backend. Each extension can override them. */
    Http http();

    /** Strings, so that {@code ExtensionRegistry} does the checks and names the bad setting. */
    interface Extension {
        Optional<String> enabled();

        Optional<String> order();

        Optional<String> backendUrl();

        /** Allows a plain http backend that is not on loopback, such as a cluster-internal host. */
        Optional<String> allowHttp();

        /**
         * {@code false} sends no identity assertion, for an open service that needs no caller identity. Hub then needs
         * no identity keys for this extension.
         */
        Optional<String> sendIdentity();

        Optional<String> connectTimeoutSeconds();

        Optional<String> requestTimeoutSeconds();

        Optional<String> maxRequestBytes();

        Optional<String> maxResponseBytes();

        Optional<String> maxConcurrentCalls();

        Optional<String> maxConcurrentStreams();

        Optional<String> maxConcurrentChatStreams();

        Optional<String> maxConcurrentStreamsPerUser();

        Optional<String> streamIdleTimeoutSeconds();

        Optional<String> maxStreamSeconds();
    }

    interface Identity {
        /** A PKCS#8 PEM file with an RSA (RS256) or P-256 (ES256) private key. */
        Optional<String> privateKeyLocation();

        /**
         * PEM files with the public keys that {@code GET /api/calm/auth/jwks} lists. The first is the
         * public key of {@link #privateKeyLocation()}. The others only verify, so that a key can change
         * with no outage.
         */
        Optional<List<String>> publicKeyLocations();

        /** The lifetime of an assertion, at most 300. */
        @WithDefault("60")
        int ttlSeconds();
    }

    interface Http {
        @WithDefault("5")
        int connectTimeoutSeconds();

        @WithDefault("10")
        int requestTimeoutSeconds();

        @WithDefault("1048576")
        int maxRequestBytes();

        @WithDefault("1048576")
        int maxResponseBytes();

        /** Calls to one extension at the same time, so that a slow backend cannot hold every worker thread. */
        @WithDefault("32")
        int maxConcurrentCalls();

        /**
         * Streamed replies of the generic proxy from one extension at the same time. Each holds a worker thread until
         * it ends.
         */
        @WithDefault("8")
        int maxConcurrentStreams();

        /** Chat replies from one extension at the same time, in their own pool. */
        @WithDefault("8")
        int maxConcurrentChatStreams();

        /** The streams of one user in each pool, so that one user cannot hold every slot. */
        @WithDefault("2")
        int maxConcurrentStreamsPerUser();

        /** The longest wait for the next part of a streamed reply. */
        @WithDefault("30")
        int streamIdleTimeoutSeconds();

        /** The longest time that a streamed reply stays open. */
        @WithDefault("300")
        int maxStreamSeconds();
    }
}
