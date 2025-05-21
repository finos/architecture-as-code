package org.finos.calm.config;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.mvstore.MVStoreModule;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Configuration for standalone mode using NitriteDB.
 * This class manages the lifecycle of the NitriteDB instance.
 */
@ApplicationScoped
public class NitriteDBConfig {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDBConfig.class);

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @ConfigProperty(name = "calm.standalone.data-directory")
    String dataDirectory;

    @ConfigProperty(name = "calm.standalone.database-name", defaultValue = "calmSchemas")
    String databaseName;

    @ConfigProperty(name = "calm.standalone.username", defaultValue = "admin")
    String username;

    @ConfigProperty(name = "calm.standalone.password", defaultValue = "admin")
    String password;

    @ConfigProperty(name = "calm.standalone.init-script-path")
    String initScriptPath;

    private Nitrite db;

    @PostConstruct
    void initialize() {
        if ("standalone".equals(databaseMode)) {
            LOG.info("Starting NitriteDB in standalone mode");
            try {
                // Ensure data directory exists
                Path dataPath = Paths.get(dataDirectory);
                if (!Files.exists(dataPath)) {
                    Files.createDirectories(dataPath);
                }

                // Configure and open NitriteDB
                Path dbFilePath = dataPath.resolve(databaseName + ".db");

                // Create the database
                // Create the MVStoreModule with the file path
                MVStoreModule storeModule = MVStoreModule.withConfig()
                        .filePath(dbFilePath.toString())
                        .autoCommit(true)
                        .build();

                db = Nitrite.builder()
                        .loadModule(storeModule)
                        .openOrCreate(username, password);

                initializeDatabase();

                LOG.info("NitriteDB started successfully at {}", dbFilePath);
            } catch (IOException e) {
                LOG.error("Failed to start NitriteDB", e);
                throw new RuntimeException("Failed to start NitriteDB", e);
            }
        }
    }


    /**
     * Initilise the DB.
     * @throws IOException
     * @throws JsonParseException
     */
    private void initializeDatabase() throws IOException, JsonParseException {
        boolean scriptExists = false;
        String scriptContent = null;

        // Create collections - just getting the collection creates it if it doesn't exist
        db.getCollection("architectures");
        db.getCollection("patterns");
        db.getCollection("namespaces");
        db.getCollection("domains");
        db.getCollection("flows");
        db.getCollection("schemas");
        db.getCollection("counters");
    }

    /**
     * Get the underlying NitriteDB instance.
     * Used in tests.
     */
    @Produces
    @ApplicationScoped
    @StandaloneQualifier
    public Nitrite getNitriteDb() {
        return db;
    }

    @PreDestroy
    void shutdown() {
        if (db != null && !db.isClosed()) {
            db.close();
            LOG.info("NitriteDB stopped");
        }
    }

}
