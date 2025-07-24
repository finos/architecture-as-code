package org.finos.calm.store.mongo;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.store.ControlStore;

import java.util.List;

@ApplicationScoped
@Typed(MongoControlStore.class)
public class MongoControlStore implements ControlStore {
    @Override
    public List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException {
        return List.of();
    }
}
