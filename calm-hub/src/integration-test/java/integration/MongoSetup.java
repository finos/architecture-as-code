package integration;

import com.mongodb.client.MongoDatabase;
import org.bson.Document;

import java.util.ArrayList;
import java.util.Arrays;

public class MongoSetup {

    /**
     * Creates a header collection if it is absent, and deliberately puts nothing in it.
     *
     * <p>These collections used to be primed with an empty one-document-per-namespace
     * document, because the old shape needed that document to exist before anything could be
     * pushed into it. Under the header/version shape there is no per-namespace document at
     * all, and priming one is actively harmful: it carries no {@code <type>Id}, so the header
     * reader surfaces it as a resource named "&lt;Type&gt; null" with zero versions, which then
     * shows up in every listing the tests assert on.</p>
     *
     * <p>Creating the empty collection is all that is needed. Shared rather than repeated per
     * test class so that the next change to this reasoning lands in one place — the previous
     * copy-per-file version drifted, and one copy went on inserting the phantom document
     * after the others had stopped.</p>
     */
    public static void primeHeaderCollection(MongoDatabase database, String collectionName) {
        if (!database.listCollectionNames().into(new ArrayList<>()).contains(collectionName)) {
            database.createCollection(collectionName);
        }
    }

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
            Document flowStoreCounter = new Document("_id", "flowStoreCounter").append("sequence_value", 0);
            Document standardStoreCounter = new Document("_id", "standardStoreCounter").append("sequence_value", 0);
            Document userAccessStoreCounter = new Document("_id", "userAccessStoreCounter").append("sequence_value", 0);
            Document controlStoreCounter = new Document("_id", "controlStoreCounter").append("sequence_value", 0);
            Document controlConfigurationStoreCounter = new Document("_id", "controlConfigurationStoreCounter").append("sequence_value", 0);
            Document decoratorStoreCounter = new Document("_id", "decoratorStoreCounter").append("sequence_value", 0);
            Document interfaceStoreCounter = new Document("_id", "interfaceStoreCounter").append("sequence_value", 0);
            database.getCollection("counters").insertOne(patternStoreCounter);
            database.getCollection("counters").insertOne(architectureStoreCounter);
            database.getCollection("counters").insertOne(adrStoreCounter);
            database.getCollection("counters").insertOne(flowStoreCounter);
            database.getCollection("counters").insertOne(standardStoreCounter);
            database.getCollection("counters").insertOne(userAccessStoreCounter);
            database.getCollection("counters").insertOne(controlStoreCounter);
            database.getCollection("counters").insertOne(controlConfigurationStoreCounter);
            database.getCollection("counters").insertOne(decoratorStoreCounter);
            database.getCollection("counters").insertOne(interfaceStoreCounter);
        }
    }
}
