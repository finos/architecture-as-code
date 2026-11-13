package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.bson.Document;
import org.finos.calm.migration.steps.MongoDecoratorSplitStep;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

/**
 * Runs the version 16 → 17 decorator split against a real MongoDB: the indexes must admit
 * the documents it writes, a second run must change nothing, and the target query must use
 * the new index.
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoDecoratorMigrationIntegration {

    private static final String NAMESPACE = "decorator-migration-fixture";
    private static final String TARGET_A = "/calm/namespaces/" + NAMESPACE + "/architectures/1/versions/1-0-0";
    private static final String TARGET_B = "/calm/namespaces/" + NAMESPACE + "/architectures/2/versions/1-0-0";

    @Inject
    MongoTestConnection mongoTestConnection;

    private MongoClient client() {
        return MongoClients.create(mongoTestConnection.connectionString());
    }

    private MongoDatabase database(MongoClient client) {
        return client.getDatabase(mongoTestConnection.database());
    }

    private static Document decorator(String uniqueId, String type, List<String> targets) {
        return new Document("unique-id", uniqueId).append("type", type).append("target", targets);
    }

    private void seedOldShape(MongoDatabase database) {
        clearFixture(database);
        database.getCollection("decorators").insertOne(new Document("namespace", NAMESPACE)
                .append("decorators", List.of(
                        new Document("decoratorId", 1).append("decorator", decorator("d-1", "deployment", List.of(TARGET_A))),
                        new Document("decoratorId", 2).append("decorator", decorator("d-2", "observability", List.of(TARGET_A, TARGET_B))),
                        new Document("decorator", decorator("no-id", "deployment", List.of(TARGET_A))))));
    }

    private void clearFixture(MongoDatabase database) {
        database.getCollection("decorators").deleteMany(Filters.eq("namespace", NAMESPACE));
        database.getCollection("decoratorsUnmigrated").deleteMany(Filters.eq("namespace", NAMESPACE));
    }

    private List<Document> fixtureDecorators(MongoDatabase database) {
        return database.getCollection("decorators").find(Filters.eq("namespace", NAMESPACE))
                .sort(new Document("decoratorId", 1)).into(new ArrayList<>());
    }

    @Test
    void split_one_namespace_document_into_one_document_per_decorator() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);

            new MongoDecoratorSplitStep(database).migrate();

            List<Document> stored = fixtureDecorators(database);
            assertThat(stored.size(), is(2));
            assertThat(stored.get(0).getInteger("decoratorId"), is(1));
            assertThat(stored.get(1).get("target"), is(List.of(TARGET_A, TARGET_B)));
            assertThat(stored.get(1).get("decorator", Document.class).getString("unique-id"), is("d-2"));
            assertThat(database.getCollection("decoratorsUnmigrated")
                    .countDocuments(Filters.eq("namespace", NAMESPACE)), is(1L));

            clearFixture(database);
        }
    }

    @Test
    void leave_the_data_untouched_when_run_a_second_time() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);
            MongoDecoratorSplitStep step = new MongoDecoratorSplitStep(database);

            step.migrate();
            List<Document> afterFirstRun = fixtureDecorators(database);
            step.migrate();

            assertThat(fixtureDecorators(database), is(afterFirstRun));
            clearFixture(database);
        }
    }

    @Test
    void answer_a_target_query_from_the_index() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);
            new MongoDecoratorSplitStep(database).migrate();

            Document plan = database.getCollection("decorators")
                    .find(Filters.and(Filters.eq("namespace", NAMESPACE), Filters.eq("target", TARGET_B)))
                    .explain();

            assertThat(plan.toJson(), containsString("namespace_1_target_1_type_1"));
            clearFixture(database);
        }
    }
}
