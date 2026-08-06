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
import org.finos.calm.migration.steps.MongoPatternVersionSplitStep;
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
