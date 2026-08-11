package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.finos.calm.migration.steps.MongoArchitectureVersionSplitStep;
import org.finos.calm.migration.steps.MongoIndexInitializationStep;
import org.finos.calm.migration.steps.MongoAdrVersionSplitStep;
import org.finos.calm.migration.steps.MongoFlowVersionSplitStep;
import org.finos.calm.migration.steps.MongoInterfaceVersionSplitStep;
import org.finos.calm.migration.steps.MongoLayoutIndexStep;
import org.finos.calm.migration.steps.MongoPatternLayoutIndexStep;
import org.finos.calm.migration.steps.MongoPatternVersionSplitStep;
import org.finos.calm.migration.steps.MongoResourceMappingIndexStep;
import org.finos.calm.migration.steps.MongoTimelineVersionSplitStep;
import org.finos.calm.migration.steps.MongoStandardVersionSplitStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.MongoDBContainer;

import java.util.Map;

public class EndToEndResource implements QuarkusTestResourceLifecycleManager {

    private MongoDBContainer mongoDBContainer;

    private static final Logger logger = LoggerFactory.getLogger(EndToEndResource.class);

    @Override
    public Map<String, String> start() {
        if(mongoDBContainer == null) {
            mongoDBContainer = new MongoDBContainer("mongo:4.4.3");
        }

        logger.info("Starting MongoDB container");
        mongoDBContainer.start();
        String connectionString = mongoDBContainer.getReplicaSetUrl();
        logger.info("MongoDB container started at {}", connectionString);
        String databaseName = connectionString.substring(connectionString.lastIndexOf("/")+1);

        // MongoIndexInitializationStep no longer runs itself under @QuarkusTest (LaunchMode.TEST
        // can't distinguish "real Mongo, via this container" from "no Mongo at all", which is
        // the common case for the rest of the test suite) — so integration tests that rely on
        // unique-index enforcement (duplicate-key rejection etc.) need it created here, against
        // the real container, before the Quarkus application under test even starts.
        try (MongoClient mongoClient = MongoClients.create(connectionString)) {
            MongoDatabase database = mongoClient.getDatabase(databaseName);
            new MongoIndexInitializationStep(database).createIndexes();
            // That step creates a unique index on architectures.namespace alone, which
            // enforces the pre-migration one-document-per-namespace shape and would make
            // a second architecture in a namespace impossible. Architecture and Pattern have
            // since moved to the header/version shape, so their indexes have to be
            // transitioned here too — the same swaps their migrations perform. Every further
            // type that migrates needs a line here, or its integration tests fail on the
            // second resource in a namespace.
            new MongoArchitectureVersionSplitStep(database).transitionIndexes();
            new MongoPatternVersionSplitStep(database).transitionIndexes();
            new MongoFlowVersionSplitStep(database).transitionIndexes();
            new MongoStandardVersionSplitStep(database).transitionIndexes();
            new MongoInterfaceVersionSplitStep(database).transitionIndexes();
            new MongoTimelineVersionSplitStep(database).transitionIndexes();
            new MongoAdrVersionSplitStep(database).transitionIndexes();
            // Not a version split — layout was never in the header/version shape to begin
            // with — but the same principle applies: without this, MongoIndexInitializationStep
            // creates no layouts index at all (it was deliberately removed from that step's
            // loop, since {namespace: 1} unique is wrong for layout's flat shape), so the
            // container would run with no unique constraint on (namespace, architectureId),
            // and MongoLayoutStore's duplicate-key retry would go untested against a real index.
            new MongoLayoutIndexStep(database).createIndexes();
            // Same reasoning as MongoLayoutIndexStep immediately above, mirrored for patterns:
            // without this, pattern_layouts would run with no unique constraint on
            // (namespace, patternId) under this container, and MongoPatternLayoutStore's
            // duplicate-key retry would go untested against a real index.
            new MongoPatternLayoutIndexStep(database).createIndexes();
            // Widens resource_mappings' unique index to (namespace, resourceType, customId) —
            // MongoIndexInitializationStep above only ever creates the old, narrower
            // (namespace, customId) index (it is never edited after being merged), so without
            // this the container keeps that 2-field unique index and a customId shared by a
            // pattern and an architecture would still collide, same as a real deployment
            // that hadn't yet reached schema version 12.
            new MongoResourceMappingIndexStep(database).createIndexes();
            logger.info("Ensured MongoDB indexes for integration tests");
        }

        return Map.of(
                "quarkus.mongodb.connection-string", connectionString,
                "quarkus.mongodb.database", databaseName
        );
    }

    @Override
    public void stop() {
        mongoDBContainer.stop();
    }
}
