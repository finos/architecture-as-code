package org.finos.calm.store.github;

import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * Shared base for the GitHub stores that resolve actual file content: id lookup, version
 * listing, and reading a specific version — the same three blocks duplicated across every
 * one of these stores before this extraction (PR #3066 review discussion). Each duplicate
 * had already drifted — {@code GitHubPatternStore} inlined two error strings its siblings
 * had hoisted into constants — which is exactly the kind of divergence a shared base
 * prevents from happening again.
 *
 * <p><strong>A version is only ever a real, resolvable SHA — never a placeholder.</strong>
 * {@link #readAtVersion} is not a superset of the old per-store "try SHA, else read
 * whatever HEAD holds" logic; that fallback silently served the wrong content for an
 * unrecognised version (see the {@code latest} sentinel it replaced — PR #3066 review
 * discussion). An unresolvable version is now {@code Optional.empty()}, and every caller
 * turns that into its own typed {@code *VersionNotFoundException} — a 404, not "here's
 * something else instead."</p>
 */
abstract class AbstractReadOnlyGitHubStore extends AbstractGitHubStore {

    private static final String SHA_PATTERN = "[0-9a-f]{7,40}";

    final GitHubCloneManager cloneManager;
    final GitHubFileHistoryClient versionService;
    final NamespaceFileReader fileReader;

    AbstractReadOnlyGitHubStore(ResourceRegistry registryService,
                                 GitHubCloneManager cloneManager,
                                 GitHubFileHistoryClient versionService,
                                 NamespaceFileReader fileReader) {
        super(registryService);
        this.cloneManager = cloneManager;
        this.versionService = versionService;
        this.fileReader = fileReader;
    }

    /**
     * CDI proxy constructor only — see {@link AbstractGitHubStore#AbstractGitHubStore()}.
     * Required here too: without it, Arc has no zero-arg path through this class to reach
     * that one, and bean validation still fails for every concrete subclass.
     */
    AbstractReadOnlyGitHubStore() {
        super();
        this.cloneManager = null;
        this.versionService = null;
        this.fileReader = null;
    }

    /**
     * Looks up the single entry of {@code type} in {@code namespace} whose content-derived
     * id matches. Returns {@link Optional#empty()} rather than throwing, so each store's
     * caller supplies its own typed {@code *NotFoundException} via
     * {@code .orElseThrow(XNotFoundException::new)}.
     */
    Optional<RegistryEntry> findEntry(String namespace, RegistryResourceType type, int id) {
        return registryService.listByType(namespace, type).stream()
                .filter(e -> (e.uniqueId().hashCode() & 0x7FFFFFFF) == id)
                .findFirst();
    }

    /**
     * The advertised version list for {@code entry}: real commit SHAs from the GitHub API
     * when available, falling back to the local clone's current HEAD SHA when the API
     * returns nothing (unreachable, rate-limited, or the file genuinely has no history via
     * this path) — never an empty-but-lying placeholder. Empty only when neither the API
     * nor a local clone can attest to any version at all.
     */
    List<String> getVersions(String namespace, RegistryEntry entry) {
        String repo = cloneManager.getRepoForNamespace(namespace);
        String branch = cloneManager.getBranchForNamespace(namespace);
        List<String> versions = (repo != null && branch != null)
                ? versionService.getFileVersions(repo, branch, entry.filePath().toString())
                : List.of();
        if (!versions.isEmpty()) {
            return versions;
        }
        String headSha = cloneManager.headSha(namespace);
        return headSha != null ? List.of(headSha) : List.of();
    }

    /**
     * Resolves {@code version} to content, reading {@code entry.filePath()} for the
     * local-HEAD case. See the four-argument overload for the disambiguation rule and for
     * stores (e.g. Standard's markdown-sibling preference) that need to read a different
     * local path than the one the version history was fetched against.
     */
    Optional<String> readAtVersion(String namespace, RegistryEntry entry, String version) throws IOException {
        return readAtVersion(namespace, entry, version, entry.filePath());
    }

    /**
     * @param localReadPath the path read for the local-HEAD case; always
     *                       {@code entry.filePath()} except where a store deliberately
     *                       prefers a different file on disk for that one case (the
     *                       GitHub-API SHA fetch below always targets
     *                       {@code entry.filePath()} regardless — the override never
     *                       changes what "this version" means, only what the local
     *                       optimisation reads when the requested version happens to be
     *                       the tree already on disk).
     */
    Optional<String> readAtVersion(String namespace, RegistryEntry entry, String version, Path localReadPath) throws IOException {
        if (version == null || !version.matches(SHA_PATTERN)) {
            return Optional.empty();
        }

        // The version being read is the exact tree the clone already holds - skip the
        // network round trip and read straight off disk.
        String headSha = cloneManager.headSha(namespace);
        if (version.equals(headSha)) {
            return Optional.of(fileReader.readContained(namespace, localReadPath));
        }

        String repo = cloneManager.getRepoForNamespace(namespace);
        if (repo == null) {
            return Optional.empty();
        }
        String content = versionService.getFileAtVersion(repo, entry.filePath().toString(), version);
        return Optional.ofNullable(content);
    }
}
