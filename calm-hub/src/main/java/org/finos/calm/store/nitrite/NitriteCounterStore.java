package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.finos.calm.config.StandaloneQualifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Implementation of a counter store using NitriteDB.
 * This class provides sequence generation functionality for various stores.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteCounterStore.class)
public class NitriteCounterStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteCounterStore.class);
    private static final String COLLECTION_NAME = "counters";
    private static final String PATTERN_COUNTER = "pattern_counter";
    private static final String ARCHITECTURE_COUNTER = "architecture_counter";
    private static final String ADR_COUNTER = "adr_counter";
    private static final String FLOW_COUNTER = "flow_counter";
    
    // Use a single document with a numeric ID to store all counters
    private static final String COUNTERS_DOC_ID = "1";

    private final NitriteCollection counterCollection;

    @Inject
    public NitriteCounterStore(@StandaloneQualifier Nitrite db) {
        this.counterCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteCounterStore initialized with collection: {}", COLLECTION_NAME);
        initializeCountersDocument();
    }
    
    /**
     * Initialize the counters document if it doesn't exist yet
     */
    private void initializeCountersDocument() {
        Document countersDoc = counterCollection.getById(NitriteId.createId(COUNTERS_DOC_ID));
        if (countersDoc == null) {
            countersDoc = Document.createDocument()
                    .put(PATTERN_COUNTER, 0)
                    .put(ARCHITECTURE_COUNTER, 0)
                    .put(ADR_COUNTER, 0)
                    .put(FLOW_COUNTER, 0);
            counterCollection.insert(countersDoc);
            LOG.info("Initialized counters document");
        }
    }

    /**
     * Get the next sequence value for pattern store.
     *
     * @return The next sequence value
     */
    public int getNextPatternSequenceValue() {
        return nextValueForCounter(PATTERN_COUNTER);
    }

    /**
     * Get the next sequence value for architecture store.
     *
     * @return The next sequence value
     */
    public int getNextArchitectureSequenceValue() {
        return nextValueForCounter(ARCHITECTURE_COUNTER);
    }

    /**
     * Get the next sequence value for ADR store.
     *
     * @return The next sequence value
     */
    public int getNextAdrSequenceValue() {
        return nextValueForCounter(ADR_COUNTER);
    }

    /**
     * Get the next sequence value for flow store.
     *
     * @return The next sequence value
     */
    public int getNextFlowSequenceValue() {
        return nextValueForCounter(FLOW_COUNTER);
    }

    /**
     * Get the next value for a specific counter.
     *
     * @param counterField The counter field name
     * @return The next sequence value
     */
    private synchronized int nextValueForCounter(String counterField) {
        Document countersDoc = counterCollection.getById(NitriteId.createId(COUNTERS_DOC_ID));
        if (countersDoc == null) {
            initializeCountersDocument();
            countersDoc = counterCollection.getById(NitriteId.createId(COUNTERS_DOC_ID));
        }
        
        Integer currentValue = countersDoc.get(counterField, Integer.class);
        int nextValue = currentValue==null ? 1 : currentValue + 1;
        
        countersDoc.put(counterField, nextValue);
        counterCollection.update(countersDoc);
        
        LOG.debug("Generated next sequence value {} for counter '{}'", nextValue, counterField);
        return nextValue;
    }
}
