package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.dizitart.no2.filters.FluentFilter.where;

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
    private static final String STANDARD_COUNTER = "standard_counter";
    private static final String USER_ACCESS_COUNTER = "user_access_counter";
    
    // Use a field to identify the counters document
    private static final String COUNTER_TYPE_FIELD = "counter_type";
    private static final String COUNTERS_DOC_TYPE = "main_counters";

    private final NitriteCollection counterCollection;

    @Inject
    public NitriteCounterStore(@StandaloneQualifier Nitrite db) {
        this.counterCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteCounterStore initialized with collection: {}", COLLECTION_NAME);
    }

    /**
     * Initialize the counters document if it doesn't exist yet
     */
    private void initializeCountersDocument() {
        Filter filter = where(COUNTER_TYPE_FIELD).eq(COUNTERS_DOC_TYPE);
        Document countersDoc = counterCollection.find(filter).firstOrNull();
        
        if (countersDoc == null) {
            countersDoc = Document.createDocument()
                    .put(COUNTER_TYPE_FIELD, COUNTERS_DOC_TYPE)
                    .put(PATTERN_COUNTER, 0)
                    .put(ARCHITECTURE_COUNTER, 0)
                    .put(ADR_COUNTER, 0)
                    .put(FLOW_COUNTER, 0)
                    .put(STANDARD_COUNTER, 0)
                    .put(USER_ACCESS_COUNTER, 0);
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
     * Get the next sequence value for standard store.
     *
     * @return The next sequence value
     */
    public int getNextStandardSequenceValue() {
        return nextValueForCounter(STANDARD_COUNTER);
    }

    /**
     * Get the next sequence value for user access store.
     *
     * @return The next sequence value
     */
    public int getNextUserAccessSequenceValue() {
        return nextValueForCounter(USER_ACCESS_COUNTER);
    }

    /**
     * Get the next value for a specific counter.
     *
     * @param counterField The counter field name
     * @return The next sequence value
     */
    private synchronized int nextValueForCounter(String counterField) {
        Filter filter = where(COUNTER_TYPE_FIELD).eq(COUNTERS_DOC_TYPE);
        Document countersDoc = counterCollection.find(filter).firstOrNull();
        
        if (countersDoc == null) {
            initializeCountersDocument();
            countersDoc = counterCollection.find(filter).firstOrNull();
        }
        
        Integer currentValue = countersDoc.get(counterField, Integer.class);
        int nextValue = currentValue == null ? 1 : currentValue + 1;
        
        countersDoc.put(counterField, nextValue);
        counterCollection.update(countersDoc);
        
        LOG.debug("Generated next sequence value {} for counter '{}'", nextValue, counterField);
        return nextValue;
    }
}
