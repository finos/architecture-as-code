package org.finos.calm.store.github.access;

import io.quarkus.arc.Arc;
import io.quarkus.arc.ArcContainer;
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
import java.util.function.BooleanSupplier;

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
 *
 * <p>The injected {@link SecurityIdentity} is request-scoped. Today the only callers are the
 * GitHub-mode control and domain stores, reached from REST resources and MCP tools, which run
 * in an active request context. Off a request thread (for example a {@code @Scheduled} sync tick
 * or the startup initializer) there is no caller identity, so when auth is enabled the filter
 * returns no namespaces instead of throwing {@code ContextNotActiveException}.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class NamespaceAccessFilter {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceAccessFilter.class);

    private final SecurityIdentity identity;
    private final UserAccessValidator accessValidator;
    private final ResourceRegistry registryService;
    private final boolean authEnabled;
    private final BooleanSupplier requestContextActive;

    @Inject
    public NamespaceAccessFilter(SecurityIdentity identity,
                                  UserAccessValidator accessValidator,
                                  ResourceRegistry registryService,
                                  @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false") boolean authEnabled) {
        this(identity, accessValidator, registryService, authEnabled,
                NamespaceAccessFilter::isRequestContextActive);
    }

    NamespaceAccessFilter(SecurityIdentity identity,
                          UserAccessValidator accessValidator,
                          ResourceRegistry registryService,
                          boolean authEnabled,
                          BooleanSupplier requestContextActive) {
        this.identity = identity;
        this.accessValidator = accessValidator;
        this.registryService = registryService;
        this.authEnabled = authEnabled;
        this.requestContextActive = requestContextActive;
    }

    private static boolean isRequestContextActive() {
        ArcContainer container = Arc.container();
        return container != null && container.requestContext().isActive();
    }

    public Set<String> getAccessibleNamespaces() {
        List<String> allNamespaces = registryService.getSnapshot().getNamespaces();

        // Distinct from calm.auth.allow-public-read (handled inside UserAccessValidator,
        // below): this is auth being off entirely, e.g. no-auth/standalone deployments,
        // where there is no real identity to resolve grants against at all.
        if (!authEnabled) {
            return new HashSet<>(allNamespaces);
        }

        if (!requestContextActive.getAsBoolean()) {
            LOG.warn("Namespace access was checked outside a request, where there is no caller identity; returning no namespaces");
            return Set.of();
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
