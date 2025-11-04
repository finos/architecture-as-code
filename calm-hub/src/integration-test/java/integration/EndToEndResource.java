package integration;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
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

