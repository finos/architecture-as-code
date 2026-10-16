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
 * GitHub-mode {@link AdrStore}: the registry indexes {@code adrs/} files as
 * {@link org.finos.calm.store.github.registry.RegistryResourceType#ADR}, but this store does
 * not serve them - there is no settled on-disk convention it could safely map to numbered,
 * revisioned ADRs. Every namespace reports zero ADRs and every per-ADR lookup is "not found".
 * {@link GitHubSearchStore} leaves ADRs out of its results for the same reason. Extends only
 * {@link AbstractGitHubStore} (not {@link AbstractReadOnlyGitHubStore}) because there is no
 * file to read - {@code verifyNamespace} is the only shared behaviour this store needs.
 */
@ApplicationScoped
@Typed(GitHubAdrStore.class)
public class GitHubAdrStore extends AbstractGitHubStore implements AdrStore {

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

    // ADRs always report zero for the namespace listing above, so a lookup of one specific
    // ADR is never going to find it either - answer "not found," the same as any other GET
    // for an ADR that doesn't exist, rather than a write-unsupported error for a request that
    // was never trying to write.
    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        verifyNamespace(adrMeta.getNamespace());
        throw new AdrNotFoundException();
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException {
        verifyNamespace(adrMeta.getNamespace());
        throw new AdrNotFoundException();
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        verifyNamespace(adrMeta.getNamespace());
        throw new AdrNotFoundException();
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
