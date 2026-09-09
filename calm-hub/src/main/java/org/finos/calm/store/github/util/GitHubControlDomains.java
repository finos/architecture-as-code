package org.finos.calm.store.github.util;

import java.nio.file.Path;

/**
 * Shared domain-extraction convention for the GitHub-backed control store: a control's
 * domain is the second path segment under a {@code controls/} directory
 * (e.g. {@code controls/security/access-control.json} -> domain {@code "security"}).
 *
 * <p>Used by both {@link org.finos.calm.store.github.GitHubDomainStore} (to list the
 * domains a namespace has) and {@link org.finos.calm.store.github.GitHubUserAccessStore}
 * (to derive which domains a user's namespace-level access should also grant read on) -
 * kept in one place so the two never drift.
 */
public final class GitHubControlDomains {

    private static final String DEFAULT_DOMAIN = "default";

    private GitHubControlDomains() {
    }

    public static String extractDomain(RegistryEntry entry) {
        Path filePath = entry.filePath();
        if (filePath.getNameCount() >= 2) {
            String firstDir = filePath.getName(0).toString();
            if ("controls".equals(firstDir)) {
                return filePath.getName(1).toString();
            }
        }
        return DEFAULT_DOMAIN;
    }
}
