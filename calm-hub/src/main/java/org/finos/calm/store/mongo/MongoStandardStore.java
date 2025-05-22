package org.finos.calm.store.mongo;

import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.store.StandardStore;

import java.util.List;

@ApplicationScoped
public class MongoStandardStore implements StandardStore {
    @Override
    public List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException {
        throw new UnsupportedOperationException();
    }

    @Override
    public Standard createStandardForNamespace(Standard standard) throws NamespaceNotFoundException {
        throw new UnsupportedOperationException();
    }

    @Override
    public List<String> getStandardVersions(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException {
        throw new UnsupportedOperationException();
    }

    @Override
    public Standard getStandardForVersion(StandardDetails standardDetails) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException {
        throw new UnsupportedOperationException();
    }

    @Override
    public Standard createStandardForVersion(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException {
        throw new UnsupportedOperationException();
    }
}
