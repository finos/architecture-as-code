package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Document;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentNotFoundException;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.finos.calm.domain.exception.DocumentVersionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DocumentStore;
import org.finos.calm.store.github.registry.ResourceRegistry;

import java.util.Collections;
import java.util.List;

/**
 * GitHub-mode {@link DocumentStore}: generic typed documents are not modelled in the
 * registry, so every namespace reports none and every lookup is "not found". The bean
 * exists so {@code /documents} requests get a clean 404 instead of an unsatisfied
 * resolution of the Mongo-gated store. Extends only {@link AbstractGitHubStore} because
 * there is no file to read.
 */
@ApplicationScoped
@Typed(GitHubDocumentStore.class)
public class GitHubDocumentStore extends AbstractGitHubStore implements DocumentStore {

    @Inject
    public GitHubDocumentStore(ResourceRegistry registryService) {
        super(registryService);
    }

    @Override
    public List<Integer> getDocumentsForNamespace(String namespace, String documentType)
            throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return Collections.emptyList();
    }

    @Override
    public Document createDocumentForNamespace(CreateDocumentRequest request, String namespace, String documentType)
            throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<String> getDocumentVersions(String namespace, String documentType, Integer id)
            throws NamespaceNotFoundException, DocumentNotFoundException {
        verifyNamespace(namespace);
        throw new DocumentNotFoundException();
    }

    @Override
    public String getDocumentForVersion(String namespace, String documentType, Integer id, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionNotFoundException {
        verifyNamespace(namespace);
        throw new DocumentNotFoundException();
    }

    @Override
    public Document createDocumentForVersion(CreateDocumentRequest request, String namespace, String documentType,
                                             Integer id, String version)
            throws NamespaceNotFoundException, DocumentNotFoundException, DocumentVersionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }
}
