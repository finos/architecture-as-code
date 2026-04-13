package integration;

import com.mongodb.client.MongoDatabase;
import org.bson.Document;

import java.util.Arrays;

public class MongoSetup {

    public static void namespaceSetup(MongoDatabase database) {
        if (database.getCollection("namespaces").countDocuments() == 0) {
            database.getCollection("namespaces").insertMany(Arrays.asList(
                    new Document("name", "finos").append("description", "FINOS namespace")
            ));
        }
    }

    public static void domainSetup(MongoDatabase database) {
        if (database.getCollection("domains").countDocuments() == 0) {
            database.getCollection("domains").insertMany(Arrays.asList(
                    new Document("name", "security")
            ));
        }
    }

    public static void counterSetup(MongoDatabase database) {
        if (database.getCollection("counters").countDocuments() == 0) {
            Document patternStoreCounter = new Document("_id", "patternStoreCounter").append("sequence_value", 0);
            Document architectureStoreCounter = new Document("_id", "architectureStoreCounter").append("sequence_value", 0);
            Document adrStoreCounter = new Document("_id", "adrStoreCounter").append("sequence_value", 0);
            Document standardStoreCounter = new Document("_id", "standardStoreCounter").append("sequence_value", 0);
            Document userAccessStoreCounter = new Document("_id", "userAccessStoreCounter").append("sequence_value", 0);
            Document controlStoreCounter = new Document("_id", "controlStoreCounter").append("sequence_value", 0);
            Document controlConfigurationStoreCounter = new Document("_id", "controlConfigurationStoreCounter").append("sequence_value", 0);
            Document decoratorStoreCounter = new Document("_id", "decoratorStoreCounter").append("sequence_value", 0);
            Document interfaceStoreCounter = new Document("_id", "interfaceStoreCounter").append("sequence_value", 0);
            database.getCollection("counters").insertOne(patternStoreCounter);
            database.getCollection("counters").insertOne(architectureStoreCounter);
            database.getCollection("counters").insertOne(adrStoreCounter);
            database.getCollection("counters").insertOne(standardStoreCounter);
            database.getCollection("counters").insertOne(userAccessStoreCounter);
            database.getCollection("counters").insertOne(controlStoreCounter);
            database.getCollection("counters").insertOne(controlConfigurationStoreCounter);
            database.getCollection("counters").insertOne(decoratorStoreCounter);
            database.getCollection("counters").insertOne(interfaceStoreCounter);
        }
    }
}
