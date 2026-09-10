package org.finos.calm.store.github.registry;

import java.nio.file.Path;

/**
 * Shared domain-extraction convention for the GitHub-backed control store: a control's
 * domain is the second path segment under a {@code controls/} directory
 * (e.g. {@code controls/security/access-control.json} -> domain {@code "security"}).
 *
 * <p>Used by both {@code GitHubDomainStore} (to list the domains a namespace has) and
 * {@code GitHubUserAccessStore} (to derive which domains a user's namespace-level access
 * should also grant read on) — kept in one place so the two never drift.
 *
 * <p>Stays a static utility deliberately: it's a pure function of a {@link RegistryEntry}
 * with no state and no configuration to inject — exactly the case static methods exist for.
 * {@code GitHubControlStore.findControlEntry} re-derives the same domain by inline substring
 * match rather than calling this — see the tracking issue for that drift.</p>
 */
public final class ControlDomains {

    private static final String DEFAULT_DOMAIN = "default";

    private ControlDomains() {
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
