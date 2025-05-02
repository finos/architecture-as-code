package org.finos.calm.store.mongo;

import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.StandardsStore;

import java.util.List;

@ApplicationScoped
public class MongoStandardsStore implements StandardsStore {
    @Override
    public List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        throw new UnsupportedOperationException();
    }

    @Override
    public Standard createStandardForNamespace(String namespace, Standard standard) throws NamespaceNotFoundException {
        throw new UnsupportedOperationException();
    }
}
