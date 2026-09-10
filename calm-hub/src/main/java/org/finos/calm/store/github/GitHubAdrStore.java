package org.finos.calm.store.github;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.github.registry.ResourceRegistry;

import java.util.Collections;
import java.util.List;

/**
 * GitHub-mode {@link AdrStore}: ADRs are not modelled in the registry at all - there is no
 * {@code RegistryResourceType.ADR} and no file-classification rule that would produce one -
 * so every namespace reports zero ADRs rather than a partial or wrong listing, and every
 * per-ADR lookup is an unconditional {@link GitHubWriteNotSupportedException}. This is a
 * deliberate scope cut, not an oversight: unlike the other resource types, ADRs have no
 * settled on-disk convention this backend could safely detect. Extends only
 * {@link AbstractGitHubStore} (not {@link AbstractReadOnlyGitHubStore}) because there is no
 * file to read - {@code verifyNamespace} is the only shared behaviour this store needs.
 */
@ApplicationScoped
@Typed(GitHubAdrStore.class)
public class GitHubAdrStore extends AbstractGitHubStore implements AdrStore {

    private static final String VERSION_UNSUPPORTED =
            "Version history via GitHub API is not yet implemented.";

    @Inject
    public GitHubAdrStore(ResourceRegistry registryService) {
        super(registryService);
    }

    @Override
    public List<NamespaceAdrSummary> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public int countAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return 0;
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrParseException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        throw new GitHubWriteNotSupportedException(VERSION_UNSUPPORTED);
    }

    @Override
    public AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) throws AdrNotFoundException, NamespaceNotFoundException, AdrRevisionNotFoundException, AdrPersistenceException, AdrParseException, AdrRevisionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteAdr(String namespace, int adrId) throws NamespaceNotFoundException, AdrNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
