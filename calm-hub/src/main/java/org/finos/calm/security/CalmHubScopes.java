package org.finos.calm.security;

public class CalmHubScopes {

    /**
     * prevent instantiation
     */
    private CalmHubScopes() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    /**
     * Allows read operations on Flows, Patterns, Namespaces, and Architectures resources.
     */
    public static final String ARCHITECTURES_READ = "architectures:read";
    public static final String ARCHITECTURES_WRITE = "architectures:write";

    /**
     * Allows full access (read, write, delete) on Flows, Patterns, Namespaces, and Architectures resources.
     */
    public static final String ARCHITECTURES_ALL = "architectures-all";

    /**
     * Allows read operations on Adrs and Namespaces resources.
     */
    public static final String ADRS_READ = "adrs:read";

    /**
     * Allows full access (read, write, delete) on Adrs and read operation on Namespaces.
     */
    public static final String ADRS_ALL = "adrs:all";

    /**
     * Allows read operations on the Search endpoint. Results are filtered based on user access grants.
     */
    public static final String SEARCH_READ = "search:read";

    public static final String PATTERNS_READ = "patterns:read";
    public static final String PATTERNS_WRITE = "patterns:write";

    public static final String FLOWS_READ = "flows:read";
    public static final String FLOWS_WRITE = "flows:write";

    public static final String ADRS_WRITE = "adrs:write";

    /**
     * Allow to grant access to users on namespace associated resources and for the admin operations.
     */
    public static final String NAMESPACE_ADMIN = "namespace:admin";
}
