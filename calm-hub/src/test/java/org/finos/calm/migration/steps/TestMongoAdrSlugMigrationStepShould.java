package org.finos.calm.migration.steps;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoAdrSlugMigrationStepShould {

    private static final Pattern ADR_ID = Pattern.compile("\"adrId\": (\\d+)");
    private static final Pattern VERSION = Pattern.compile("\"version\": \"(\\d+)\"");

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoAdrSlugMigrationStep step;

    @BeforeEach
    void setup() {
        MongoDatabase database = mock(MongoDatabase.class);
        headerCollection = mock(DocumentMongoCollection.class);
        versionCollection = mock(DocumentMongoCollection.class);
        when(database.getCollection("adrs")).thenReturn(headerCollection);
        when(database.getCollection("adrVersions")).thenReturn(versionCollection);

        step = new MongoAdrSlugMigrationStep(database);
        step.databaseMode = "mongo";
    }

    /** Headers in the (namespace, adrId) order the step's sorted query returns them in. */
    private void stubHeaders(List<Document> headers) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        when(headerCollection.find()).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            headers.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
    }

    /**
     * Each ADR's revisions and their titles: {@code adrId -> (revision -> title)}. The version
     * collection is answered per query, so each ADR reads its own revision 1.
     */
    private void stubRevisions(Map<Integer, Map<String, String>> titles) {
        when(versionCollection.find(any(Bson.class))).thenAnswer(invocation -> {
            String filter = ((Bson) invocation.getArgument(0)).toBsonDocument().toJson();
            Matcher id = ADR_ID.matcher(filter);
            Map<String, String> revisions = id.find()
                    ? titles.getOrDefault(Integer.parseInt(id.group(1)), Map.of())
                    : Map.of();
            Matcher version = VERSION.matcher(filter);
            String wanted = version.find() ? version.group(1) : null;

            FindIterable<Document> iterable = mock(DocumentFindIterable.class);
            when(iterable.projection(any())).thenReturn(iterable);
            String title = wanted == null ? null : revisions.get(wanted);
            when(iterable.first()).thenReturn(wanted != null && revisions.containsKey(wanted)
                    ? new Document("content", title == null ? new Document() : new Document("title", title))
                    : null);
            doAnswer(each -> {
                Consumer<Document> consumer = each.getArgument(0);
                revisions.keySet().forEach(revision -> consumer.accept(new Document("version", revision)));
                return null;
            }).when(iterable).forEach(any());
            return iterable;
        });
    }

    private static Document header(String namespace, int adrId) {
        return new Document("namespace", namespace).append("adrId", adrId);
    }

    /** The slug written to each header, by adrId, in write order. */
    private Map<Integer, String> writtenSlugs(int writes) {
        ArgumentCaptor<Bson> filters = ArgumentCaptor.forClass(Bson.class);
        ArgumentCaptor<Bson> updates = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection, org.mockito.Mockito.times(writes)).updateOne(filters.capture(), updates.capture());
        Map<Integer, String> slugs = new LinkedHashMap<>();
        for (int i = 0; i < writes; i++) {
            Matcher id = ADR_ID.matcher(filters.getAllValues().get(i).toBsonDocument().toJson());
            id.find();
            Document update = Document.parse(updates.getAllValues().get(i).toBsonDocument().toJson());
            slugs.put(Integer.parseInt(id.group(1)), update.get("$set", Document.class).getString("slug"));
        }
        return slugs;
    }

    @Test
    void run_at_schema_version_sixteen() {
        assertThat(step.fromVersion(), is(16));
    }

    @Test
    void skip_when_database_mode_is_not_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verify(headerCollection, never()).find();
        verify(headerCollection, never()).createIndex(any(Bson.class), any(IndexOptions.class));
    }

    @Test
    void derive_each_slug_from_revision_one_not_the_latest_title() {
        stubHeaders(List.of(header("finos", 1)));
        stubRevisions(Map.of(1, Map.of("1", "Use OAuth2", "2", "Renamed Later")));

        step.backfill();

        assertThat(writtenSlugs(1), is(Map.of(1, "use-oauth2")));
    }

    @Test
    void suffix_colliding_slugs_in_ascending_id_order() {
        stubHeaders(List.of(header("finos", 1), header("finos", 2), header("finos", 3), header("other", 4)));
        stubRevisions(Map.of(
                1, Map.of("1", "Use Kafka"),
                2, Map.of("1", "Use Kafka!"),
                3, Map.of("1", "use kafka"),
                4, Map.of("1", "Use Kafka")));

        step.backfill();

        assertThat(writtenSlugs(4), is(Map.of(1, "use-kafka", 2, "use-kafka-2", 3, "use-kafka-3", 4, "use-kafka")));
    }

    @Test
    void leave_existing_slugs_alone_and_reserve_them_first() {
        // ADR 2 was given use-kafka by a run that stopped part way; ADR 1 must not take it.
        stubHeaders(List.of(header("finos", 1), header("finos", 2).append("slug", "use-kafka")));
        stubRevisions(Map.of(1, Map.of("1", "Use Kafka")));

        step.backfill();

        assertThat(writtenSlugs(1), is(Map.of(1, "use-kafka-2")));
    }

    @Test
    void write_nothing_when_every_header_already_has_a_slug() {
        stubHeaders(List.of(header("finos", 1).append("slug", "use-kafka")));

        step.backfill();

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void fall_back_to_the_earliest_revision_then_to_the_numeric_id() {
        stubHeaders(List.of(header("finos", 1), header("finos", 2), header("finos", 3)));
        stubRevisions(Map.of(
                1, Map.of("2", "Second Revision Title"),
                2, Map.of(),
                3, Map.of("1", "2024")));

        step.backfill();

        assertThat(writtenSlugs(3), is(Map.of(1, "second-revision-title", 2, "adr-2", 3, "adr-3")));
    }

    @Test
    void use_the_numeric_id_when_revision_one_has_no_title() {
        stubHeaders(List.of(header("finos", 5)));
        stubRevisions(Map.of(5, java.util.Collections.singletonMap("1", null)));

        step.backfill();

        assertThat(writtenSlugs(1), is(Map.of(5, "adr-5")));
    }

    @Test
    void skip_a_malformed_header() {
        stubHeaders(List.of(new Document("adrId", 1), new Document("namespace", "finos")));

        step.backfill();

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void create_a_partial_unique_index_on_namespace_and_slug_after_the_backfill() {
        stubHeaders(List.of());

        step.apply();

        ArgumentCaptor<Bson> keys = ArgumentCaptor.forClass(Bson.class);
        ArgumentCaptor<IndexOptions> options = ArgumentCaptor.forClass(IndexOptions.class);
        verify(headerCollection).createIndex(keys.capture(), options.capture());
        assertThat(keys.getValue().toBsonDocument().toJson(), is("{\"namespace\": 1, \"slug\": 1}"));
        assertThat(options.getValue().isUnique(), is(true));
        assertThat(options.getValue().getPartialFilterExpression().toBsonDocument().toJson(),
                is("{\"slug\": {\"$type\": \"string\"}}"));
    }
}
