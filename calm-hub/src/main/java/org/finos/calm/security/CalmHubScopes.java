package org.finos.calm.security;

public class CalmHubScopes {

    /**
     * prevent instantiation
     */
    private CalmHubScopes() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    public static final String ARCHITECTURES_READ = "architectures:read";
    public static final String ARCHITECTURES_WRITE = "architectures:write";

    public static final String ADRS_READ = "adrs:read";
    public static final String ADRS_WRITE = "adrs:write";

    /**
     * Allows read operations on the Search endpoint. Results are filtered based on user access grants.
     */
    public static final String SEARCH_READ = "search:read";

    public static final String PATTERNS_READ = "patterns:read";
    public static final String PATTERNS_WRITE = "patterns:write";

    public static final String FLOWS_READ = "flows:read";
    public static final String FLOWS_WRITE = "flows:write";

    public static final String INTERFACES_READ = "interfaces:read";
    public static final String INTERFACES_WRITE = "interfaces:write";

    public static final String STANDARDS_READ = "standards:read";
    public static final String STANDARDS_WRITE = "standards:write";

    /**
     * Allow to grant access to users on namespace associated resources and for the admin operations.
     */
    public static final String NAMESPACE_ADMIN = "namespace:admin";

    /**
     * Platform-level roles reflecting the PERMISSIONS.md hierarchy.
     * ROLE_VIEWER implies all resource-type :read permissions.
     * ROLE_CONTRIBUTOR implies all resource-type :write permissions (and therefore :read).
     * ROLE_ADMIN implies namespace:admin across all namespaces (and therefore all write/read).
     */
    public static final String ROLE_VIEWER = "calm-hub-viewer";
    public static final String ROLE_CONTRIBUTOR = "calm-hub-contributor";
    public static final String ROLE_ADMIN = "calm-hub-admin";
}
