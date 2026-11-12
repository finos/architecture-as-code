package org.finos.calm.services;

import io.quarkus.runtime.StartupEvent;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.interceptor.Interceptor;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.config.DatabaseMode;
import org.finos.calm.config.PersonalNamespacesConfig;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.PersonalNamespace;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;

/**
 * Personal namespaces: one private namespace for each principal under a configured root.
 * See {@code PERSONAL_NAMESPACES.md} and ADR 0018.
 */
@ApplicationScoped
public class PersonalNamespaceService {

    private static final Logger LOG = LoggerFactory.getLogger(PersonalNamespaceService.class);

    private static final Pattern PRINCIPAL_PATTERN = Pattern.compile("^[A-Za-z0-9.@_-]+$");
    private static final String PUBLIC_USER = "*";

    public enum CreateOutcome { CREATED, ALREADY_OWNED, TAKEN }

    private final PersonalNamespacesConfig config;
    private final NamespaceService namespaceService;
    private final NamespaceStore namespaceStore;
    private final UserAccessStore userAccessStore;
    private final boolean allowPublicRead;
    private final String inactiveReason;

    @Inject
    public PersonalNamespaceService(PersonalNamespacesConfig config,
                                    NamespaceService namespaceService,
                                    NamespaceStore namespaceStore,
                                    UserAccessStore userAccessStore,
                                    @ConfigProperty(name = "calm.auth.enabled", defaultValue = "false") boolean authEnabled,
                                    @ConfigProperty(name = "calm.auth.allow-public-read", defaultValue = "false") boolean allowPublicRead,
                                    @ConfigProperty(name = "calm.readonly", defaultValue = "false") boolean readOnly,
                                    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo") String databaseMode) {
        this.config = config;
        this.namespaceService = namespaceService;
        this.namespaceStore = namespaceStore;
        this.userAccessStore = userAccessStore;
        this.allowPublicRead = allowPublicRead;
        this.inactiveReason = inactiveReason(config.enabled(), authEnabled, readOnly, databaseMode);
    }

    private static String inactiveReason(boolean enabled, boolean authEnabled, boolean readOnly, String databaseMode) {
        if (!enabled) return "not enabled";
        if (!authEnabled) return "auth is off";
        if (readOnly) return "Hub is read-only";
        if (DatabaseMode.GITHUB.equals(databaseMode)) return "Hub is in GitHub mode";
        return null;
    }

    public boolean isActive() {
        return inactiveReason == null;
    }

    // Runs after the default-priority observers, so that schema migrations finish first.
    void onStartup(@Observes @Priority(Interceptor.Priority.APPLICATION + 600) StartupEvent event) {
        if (!config.enabled()) {
            return;
        }
        if (!isActive()) {
            LOG.warn("calm.namespaces.personal.enabled is true, but personal namespaces stay off because {}", inactiveReason);
            return;
        }
        if (!config.root().matches(NAMESPACE_REGEX)) {
            throw new IllegalStateException("calm.namespaces.personal.root must match " + NAMESPACE_REGEX);
        }
        if (allowPublicRead) {
            LOG.warn("calm.auth.allow-public-read is true, so all users can read personal namespaces");
        }
        try {
            ensureRoot();
        } catch (RuntimeException e) {
            LOG.error("Could not prepare the personal namespace root [{}]", config.root(), e);
        }
    }

    private void ensureRoot() {
        String root = config.root();
        if (!namespaceStore.namespaceExists(root)) {
            try {
                namespaceService.createNamespace(root, "Personal namespaces");
                LOG.info("Created personal namespace root [{}]", root);
                return;
            } catch (NamespaceAlreadyExistsException e) {
                LOG.debug("Personal namespace root [{}] was created by another instance", root);
            }
        }
        if (!hasPublicRead(root)) {
            LOG.warn("Personal namespace root [{}] has no * read grant, so owners cannot read their own namespaces", root);
        }
    }

    private boolean hasPublicRead(String namespace) {
        try {
            return userAccessStore.getUserAccessForNamespace(namespace).stream()
                    .anyMatch(g -> PUBLIC_USER.equals(g.getUsername()));
        } catch (NamespaceNotFoundException e) {
            return false;
        }
    }

    /**
     * Returns the personal namespace name for a principal, or empty when the principal
     * has a character that cannot be mapped to a namespace segment.
     */
    public Optional<String> namespaceFor(String principal) {
        if (principal == null || !PRINCIPAL_PATTERN.matcher(principal).matches()) {
            return Optional.empty();
        }
        return Optional.of(config.root() + "." + principal.replaceAll("[.@_]", "-"));
    }

    /**
     * True when the name is a child of the root while the feature is active. The general
     * create paths reject these names, so every personal namespace comes from {@link #create}.
     */
    public boolean isReserved(String namespace) {
        return isActive() && namespace.startsWith(config.root() + ".");
    }

    public Optional<PersonalNamespace> get(String principal) {
        return namespaceFor(principal).map(name -> {
            boolean exists = namespaceStore.namespaceExists(name);
            return new PersonalNamespace(name, exists, exists && isOwner(principal, name));
        });
    }

    /**
     * Creates the principal's personal namespace with an admin grant for them and no
     * {@code *} read grant. Never grants anything on a namespace that already exists.
     */
    public Optional<CreateOutcome> create(String principal) {
        Optional<String> name = namespaceFor(principal);
        if (name.isEmpty()) {
            return Optional.empty();
        }
        String namespace = name.get();
        try {
            namespaceStore.createNamespace(namespace, "Personal namespace for " + principal);
        } catch (NamespaceAlreadyExistsException e) {
            return Optional.of(isOwner(principal, namespace) ? CreateOutcome.ALREADY_OWNED : CreateOutcome.TAKEN);
        }
        try {
            userAccessStore.createUserAccessForNamespace(new UserAccess(principal, UserAccess.Permission.admin, namespace));
        } catch (NamespaceNotFoundException e) {
            throw new IllegalStateException("Personal namespace disappeared before its owner grant was written", e);
        }
        LOG.info("Created personal namespace [{}]", namespace);
        return Optional.of(CreateOutcome.CREATED);
    }

    private boolean isOwner(String principal, String namespace) {
        try {
            List<UserAccess> grants = userAccessStore.getUserAccessForNamespace(namespace);
            return grants.stream().anyMatch(g -> principal.equals(g.getUsername())
                    && g.getPermission() == UserAccess.Permission.admin);
        } catch (NamespaceNotFoundException e) {
            return false;
        }
    }
}
