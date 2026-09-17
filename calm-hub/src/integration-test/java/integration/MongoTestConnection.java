package integration;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * CDI-injected view of the Mongo connection details EndToEndResource provisions per test
 * profile. Unlike ConfigProvider.getConfig().getValue(...) called directly from test code,
 * this goes through Quarkus's own config injection path, which stays in sync with
 * QuarkusTestResourceLifecycleManager#start() overrides (see quarkusio/quarkus#52919 -
 * system-properties-based propagation for test resources was removed in Quarkus 3.35).
 */
@ApplicationScoped
public class MongoTestConnection {

    @ConfigProperty(name = "quarkus.mongodb.connection-string")
    String connectionString;

    @ConfigProperty(name = "quarkus.mongodb.database")
    String database;

    public String connectionString() {
        return connectionString;
    }

    public String database() {
        return database;
    }
}
