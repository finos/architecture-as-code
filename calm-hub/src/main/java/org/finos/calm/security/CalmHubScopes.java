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

    /**
     * Allows full access (read, write, delete) on Flows, Patterns, Namespaces, and Architectures resources.
     */
    public static final String ARCHITECTURES_ALL = "architectures:all";

    /**
     * Allows read operations on Adrs and Namespaces resources.
     */
    public static final String ADRS_READ = "adrs:read";

    /**
     * Allows full access (read, write, delete) on Adrs and read operation on Namespaces.
     */
    public static final String ADRS_ALL = "adrs:all";

    /**
     * Allow to grant access to users on namespace associated resources and for the admin operations.
     */
    public static final String NAMESPACE_ADMIN="namespace:admin";
}
