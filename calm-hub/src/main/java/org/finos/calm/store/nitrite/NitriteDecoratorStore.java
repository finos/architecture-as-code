package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB implementation of DecoratorStore.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteDecoratorStore.class)
public class NitriteDecoratorStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDecoratorStore.class);
    private static final String COLLECTION_NAME = "decorators";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String DECORATORS_FIELD = "decorators";
    private static final String DECORATOR_ID_FIELD = "decoratorId";

    private final NitriteCollection decoratorCollection;
    private final NitriteNamespaceStore namespaceStore;

    @Inject
    public NitriteDecoratorStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.decoratorCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        LOG.info("NitriteDecoratorStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found when retrieving decorators", namespace);
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document namespaceDoc = decoratorCollection.find(filter).firstOrNull();

        if (namespaceDoc == null) {
            LOG.debug("No decorators found for namespace '{}'", namespace);
            return List.of();
        }

        TypeSafeNitriteDocument<Document> typeSafeDoc = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
        List<Document> decorators = typeSafeDoc.getList(DECORATORS_FIELD);

        if (decorators == null || decorators.isEmpty()) {
            LOG.debug("Decorators list is empty for namespace '{}'", namespace);
            return List.of();
        }

        List<Integer> decoratorIds = new ArrayList<>();
        for (Document decoratorDoc : decorators) {
            Integer decoratorId = decoratorDoc.get(DECORATOR_ID_FIELD, Integer.class);
            if (decoratorId == null) {
                continue;
            }

            // Apply filters if provided
            Document decorator = decoratorDoc.get("decorator", Document.class);
            if (decorator != null) {
                // Filter by type if provided
                if (type != null && !type.isEmpty()) {
                    String decoratorType = decorator.get("type", String.class);
                    if (decoratorType == null || !decoratorType.equals(type)) {
                        continue;
                    }
                }

                // Filter by target if provided
                if (target != null && !target.isEmpty()) {
                    Object targetObj = decorator.get("target");
                    List<String> targets = null;
                    if (targetObj instanceof List) {
                        @SuppressWarnings("unchecked")
                        List<String> targetList = (List<String>) targetObj;
                        targets = targetList;
                    }
                    if (targets == null || !targets.contains(target)) {
                        continue;
                    }
                }
            }

            decoratorIds.add(decoratorId);
        }

        LOG.debug("Retrieved {} decorators for namespace '{}' with filters (target: {}, type: {})", 
                decoratorIds.size(), namespace, target, type);
        return decoratorIds;
    }
}
