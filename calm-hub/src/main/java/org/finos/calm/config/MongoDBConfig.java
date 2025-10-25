package org.finos.calm.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class MongoDBConfig {

    @ConfigProperty(name = "quarkus.mongodb.database")
    String databaseName;

    @Inject
    MongoClient mongoClient;

    @Produces
    @ApplicationScoped
    public MongoDatabase mongoDatabase() {
        return mongoClient.getDatabase(databaseName);
    }
}
