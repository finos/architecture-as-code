package org.finos.calm.store.github.access;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Resolves the set of namespaces the current caller can access, for GitHub-mode stores
 * that need to restrict domain/control visibility (which have no per-namespace resource
 * to run the usual {@code @PermissionsAllowed} check against) to namespaces the caller
 * can actually read.
 *
 * <p>Delegates the identity-based decision to {@link UserAccessValidator}, the same
 * grant-resolution path {@code SearchResource}/{@code DomainResource} use, rather than
 * re-deriving it from OIDC role/group membership directly. An earlier version of this
 * class did exactly that — a second, independent implementation of "what can this user
 * read" that silently diverged from {@link UserAccessValidator} on two counts:
 * {@code calm.auth.allow-public-read} was never consulted (public-read deployments still
 * got narrowed to the caller's own OIDC groups), and {@link UserAccessValidator}'s
 * ancestor-chain AND rule wasn't applied. {@link UserAccessValidator#getReadableNamespaces}
 * already calls into {@code UserAccessStore.getGrantsForUser}, which in GitHub mode is
 * {@code GitHubUserAccessStore} — the OIDC role resolution still happens, just in one
 * place instead of two.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class NamespaceAccessFilter {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceAccessFilter.class);

    private final SecurityIdentity identity;
    private final UserAccessValidator accessValidator;
    private final ResourceRegistry registryService;
    private final boolean authEnabled;

    @Inject
    public NamespaceAccessFilter(SecurityIdentity identity,
                                  UserAccessValidator accessValidator,
                                  ResourceRegistry registryService,
                                  @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false") boolean authEnabled) {
        this.identity = identity;
        this.accessValidator = accessValidator;
        this.registryService = registryService;
        this.authEnabled = authEnabled;
    }

    public Set<String> getAccessibleNamespaces() {
        List<String> allNamespaces = registryService.getSnapshot().getNamespaces();

        // Distinct from calm.auth.allow-public-read (handled inside UserAccessValidator,
        // below): this is auth being off entirely, e.g. no-auth/standalone deployments,
        // where there is no real identity to resolve grants against at all.
        if (!authEnabled) {
            return new HashSet<>(allNamespaces);
        }

        if (identity == null || identity.isAnonymous()) {
            return Set.of();
        }

        Optional<Set<String>> readable = accessValidator.getReadableNamespaces(identity.getPrincipal().getName());
        Set<String> accessible = readable.isPresent()
                ? new HashSet<>(readable.get())
                // Optional.empty() means "every namespace is readable" (allow-public-read,
                // or a GLOBAL admin grant) - readable.get() has no namespace list to
                // intersect against in that case, so fall back to every namespace the
                // registry actually knows about.
                : new HashSet<>(allNamespaces);
        accessible.retainAll(allNamespaces);

        LOG.debug("User [{}] has access to {} of {} namespaces",
                identity.getPrincipal().getName(), accessible.size(), allNamespaces.size());

        return accessible;
    }
}
