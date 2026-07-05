package org.finos.calm.security;

public class CalmHubScopes {

    /**
     * prevent instantiation
     */
    private CalmHubScopes() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    public static final String READ = "read";
    public static final String WRITE = "write";
    public static final String ADMIN = "admin";

    public static final String DOMAIN_READ = "domain_read";
    public static final String DOMAIN_WRITE = "domain_write";
    public static final String DOMAIN_ADMIN = "domain_admin";

    public static final String GLOBAL_ADMIN = "global_admin";
}
