package integration;

import com.mongodb.client.MongoDatabase;
import org.bson.Document;

import java.util.ArrayList;
import java.util.Arrays;

public class MongoSetup {

    public static void namespaceSetup(MongoDatabase database) {
        // Ensure the 'namespaces' collection exists
        if (!database.listCollectionNames().into(new ArrayList<>()).contains("namespaces")) {
            database.createCollection("namespaces");
            // Insert multiple documents into 'namespaces'
            database.getCollection("namespaces").insertMany(Arrays.asList(
                    new Document("namespace", "finos")
            ));
        }
    }

    public static void counterSetup(MongoDatabase database) {
        //Setup Counter
        if (!database.listCollectionNames().into(new ArrayList<>()).contains("counters")) {
            database.createCollection("counters");
            Document patternStoreCounter = new Document("_id", "patternStoreCounter").append("sequence_value", 0);
            Document architectureStoreCounter = new Document("_id", "architectureStoreCounter").append("sequence_value", 0);
            database.getCollection("counters").insertOne(patternStoreCounter);
            database.getCollection("counters").insertOne(architectureStoreCounter);
        }
    }
}
