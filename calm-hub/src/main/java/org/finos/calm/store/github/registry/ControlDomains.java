package org.finos.calm.store.github.registry;

import java.nio.file.Path;

/**
 * Shared domain-extraction convention for the GitHub-backed control store: a control's
 * domain is the second path segment under a {@code controls/} directory
 * (e.g. {@code controls/security/access-control.json} -> domain {@code "security"}).
 *
 * <p>Used by {@code GitHubDomainStore} (to list the domains a namespace has),
 * {@code GitHubUserAccessStore} (to derive which domains a user's namespace-level access
 * should also grant read on), and {@code GitHubControlStore} (to resolve a control's domain
 * for lookup and listing) — kept in one place so none of the three drift. They previously
 * did: {@code GitHubControlStore} re-derived the domain via an inline substring match
 * ({@code path.contains("controls/" + domain + "/")}), which — unlike this method's
 * first-path-segment rule — matched {@code controls/} at any depth, not just the root. A
 * control at a non-root path like {@code foo/controls/security/x.json} would resolve to
 * domain {@code "security"} here but {@code "default"} there, so a grant for one domain
 * wrongly allowed or denied access derived via the other.
 *
 * <p>Stays a static utility deliberately: it's a pure function of a {@link RegistryEntry}
 * with no state and no configuration to inject — exactly the case static methods exist for.</p>
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
