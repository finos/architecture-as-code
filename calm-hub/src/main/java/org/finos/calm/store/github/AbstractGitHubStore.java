package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.registry.ResourceRegistry;

/**
 * Shared base for the read-only GitHub-backed stores: {@code verifyNamespace} and the
 * write-unsupported message text were duplicated byte-for-byte across every store in this
 * package before this extraction (see PR #3066 review discussion — "no shared base class
 * or trait" — and the tracking issue for this base).
 *
 * <p>Deliberately holds only what every GitHub store needs, including the ones with no
 * content to read (ADR, Decorator — both return empty results / throw for everything else,
 * with no clone/version/file-read collaborators). {@link AbstractReadOnlyGitHubStore} adds
 * the read-path machinery for the stores that actually resolve file content.</p>
 */
abstract class AbstractGitHubStore {

    static final String WRITE_UNSUPPORTED =
            "Write operations are not yet available. GitHub account linking and PR creation will be enabled in a future release.";

    final ResourceRegistry registryService;

    AbstractGitHubStore(ResourceRegistry registryService) {
        this.registryService = registryService;
    }

    /**
     * CDI proxy constructor only — never call this directly. Every concrete subclass is an
     * {@code @ApplicationScoped} (normal-scoped) bean, and Arc generates a client proxy that
     * subclasses the bean class; that generated subclass needs a no-args constructor to
     * exist somewhere in the hierarchy to compile, even though the proxy never actually runs
     * it against real collaborators — every real call is delegated to the container-managed
     * instance built through {@link #AbstractGitHubStore(ResourceRegistry)}. Without this,
     * Arc fails bean validation with "unproxyable bean class" for every subclass.
     */
    AbstractGitHubStore() {
        this.registryService = null;
    }

    void verifyNamespace(String namespace) throws NamespaceNotFoundException {
        if (!registryService.getSnapshot().getNamespaces().contains(namespace)) {
            throw new NamespaceNotFoundException();
        }
    }
}
