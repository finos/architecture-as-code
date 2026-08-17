package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.migration.steps.MongoArchitectureVersionSplitStep;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

/**
 * Exercises the version 2 → 3 architecture split against a real MongoDB, which is the only
 * way to check the parts the mocked unit tests structurally cannot: that the unique indexes
 * it creates actually admit the documents it writes, and that a second run is a genuine
 * no-op rather than a duplicate-key failure.
 *
 * <p>Uses its own namespace so it neither sees nor disturbs the data the other integration
 * tests set up in the shared container.</p>
 */
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class MongoArchitectureMigrationIntegration {

    private static final String NAMESPACE = "migration-fixture";
    private static final String V1 = "{\"nodes\": [], \"relationships\": []}";
    private static final String V2 = "{\"nodes\": [{\"unique-id\": \"n1\"}], \"relationships\": []}";

    private MongoDatabase database(MongoClient client) {
        return client.getDatabase(ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class));
    }

    private MongoClient client() {
        return MongoClients.create(
                ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class));
    }

    /**
     * Writes the old shape directly: one document for the whole namespace, holding an array
     * of architectures, each with an embedded map of every version's full content, keyed by
     * dash-encoded version.
     */
    private void seedOldShape(MongoDatabase database) {
        clearFixture(database);
        database.getCollection("architectures").insertOne(new Document("namespace", NAMESPACE)
                .append("architectures", List.of(
                        new Document("architectureId", 1)
                                .append("name", "First")
                                .append("description", "The first one")
                                .append("versions", new Document("1-0-0", Document.parse(V1))
                                        .append("1-1-0", Document.parse(V2))),
                        new Document("architectureId", 2)
                                .append("name", "Second")
                                .append("description", "The second one")
                                .append("versions", new Document("2-0-0", Document.parse(V1))))));
    }

    private void clearFixture(MongoDatabase database) {
        database.getCollection("architectures").deleteMany(Filters.eq("namespace", NAMESPACE));
        database.getCollection("architectureVersions").deleteMany(Filters.eq("namespace", NAMESPACE));
    }

    private List<Document> fixtureHeaders(MongoDatabase database) {
        return sortedBy(database.getCollection("architectures"), "architectureId");
    }

    private List<Document> fixtureVersions(MongoDatabase database) {
        return sortedBy(database.getCollection("architectureVersions"), "version");
    }

    private List<Document> sortedBy(MongoCollection<Document> collection, String field) {
        List<Document> documents = new ArrayList<>();
        collection.find(Filters.eq("namespace", NAMESPACE)).sort(new Document(field, 1)).forEach(documents::add);
        return documents;
    }

    @Test
    void fan_one_namespace_document_out_into_headers_and_versions() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);

            new MongoArchitectureVersionSplitStep(database).migrate();

            List<Document> headers = fixtureHeaders(database);
            assertThat(headers.size(), is(2));
            assertThat(headers.get(0).getString("name"), is("First"));
            assertThat(headers.get(0).getInteger("versionCount"), is(2));
            assertThat(headers.get(1).getString("name"), is("Second"));
            assertThat(headers.get(1).getInteger("versionCount"), is(1));
            // The array the old shape hung everything off is gone, not merely emptied.
            assertThat(headers.get(0).get("architectures"), is(nullValue()));

            List<Document> versions = fixtureVersions(database);
            assertThat(versions.stream().map(d -> d.getString("version")).toList(),
                    contains("1.0.0", "1.1.0", "2.0.0"));

            clearFixture(database);
        }
    }

    @Test
    void preserve_every_version_content_exactly() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);

            new MongoArchitectureVersionSplitStep(database).migrate();

            List<Document> versions = fixtureVersions(database);
            // The point of the migration is that nothing is lost in the move, so compare
            // content rather than just counting documents.
            assertThat(versions.get(0).get("content", Document.class), is(Document.parse(V1)));
            assertThat(versions.get(1).get("content", Document.class), is(Document.parse(V2)));
            assertThat(versions.get(2).get("content", Document.class), is(Document.parse(V1)));

            clearFixture(database);
        }
    }

    @Test
    void leave_the_data_untouched_when_run_a_second_time() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);

            MongoArchitectureVersionSplitStep step = new MongoArchitectureVersionSplitStep(database);
            step.migrate();
            List<Document> headersAfterFirst = fixtureHeaders(database);
            List<Document> versionsAfterFirst = fixtureVersions(database);

            // A failed step leaves the schema version unadvanced and is retried on the next
            // startup, so re-running has to be safe. Against a real database this also
            // proves the unique indexes don't reject the second pass.
            step.migrate();

            assertThat(fixtureHeaders(database), is(headersAfterFirst));
            assertThat(fixtureVersions(database), is(versionsAfterFirst));

            clearFixture(database);
        }
    }

    @Test
    void complete_a_run_that_previously_stopped_part_way() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            seedOldShape(database);

            // Stand in for a crash after the first architecture's header was written but
            // before its source document was deleted: the header is already there, and the
            // old document still lists both architectures.
            database.getCollection("architectures").insertOne(new Document("namespace", NAMESPACE)
                    .append("architectureId", 1)
                    .append("name", "Stale")
                    .append("versionCount", 99)
                    .append("metadata", new Document()));

            new MongoArchitectureVersionSplitStep(database).migrate();

            List<Document> headers = fixtureHeaders(database);
            assertThat(headers.size(), is(2));
            // Rewritten from the source rather than left at the half-finished value.
            assertThat(headers.get(0).getString("name"), is("First"));
            assertThat(headers.get(0).getInteger("versionCount"), is(2));

            clearFixture(database);
        }
    }

    @Test
    void admit_two_architectures_in_one_namespace_after_the_index_swap() {
        try (MongoClient client = client()) {
            MongoDatabase database = database(client);
            clearFixture(database);

            new MongoArchitectureVersionSplitStep(database).transitionIndexes();

            // Impossible before the swap: the old unique index on namespace alone allowed
            // exactly one architectures document per namespace. This is the constraint the
            // whole shape change depends on being gone.
            MongoCollection<Document> headers = database.getCollection("architectures");
            headers.insertOne(new Document("namespace", NAMESPACE).append("architectureId", 1));
            headers.insertOne(new Document("namespace", NAMESPACE).append("architectureId", 2));

            assertThat(fixtureHeaders(database).size(), is(2));

            clearFixture(database);
        }
    }
}
