package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.ServerAddress;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.BsonDocument;
import org.bson.BsonInt32;
import org.bson.BsonString;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Deep coverage of {@link MongoControlSplitMigration}'s two-level fan-out, exercised through
 * the step exactly as {@code TestMongoArchitectureVersionSplitStepShould} covers
 * {@link MongoVersionSplitMigration} — Control has no sibling type sharing this class, so the
 * coverage has to live here rather than being split across several thin wiring tests.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoControlVersionSplitStepShould {

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> controlHeaders;
    private MongoCollection<Document> controlVersions;
    private MongoCollection<Document> configHeaders;
    private MongoCollection<Document> configVersions;
    private MongoControlVersionSplitStep step;

    @BeforeEach
    void setup() {
        MongoDatabase database = mock(MongoDatabase.class);
        controlHeaders = mock(DocumentMongoCollection.class);
        controlVersions = mock(DocumentMongoCollection.class);
        configHeaders = mock(DocumentMongoCollection.class);
        configVersions = mock(DocumentMongoCollection.class);
        when(database.getCollection("controls")).thenReturn(controlHeaders);
        when(database.getCollection("controlVersions")).thenReturn(controlVersions);
        when(database.getCollection("controlConfigurations")).thenReturn(configHeaders);
        when(database.getCollection("controlConfigurationVersions")).thenReturn(configVersions);

        step = new MongoControlVersionSplitStep(database);
        step.databaseMode = "mongo";
        stubOldDocuments(List.of());
    }

    /** Models the step's two-pass read, matching every other split step's test. */
    private void stubOldDocuments(List<Document> documents) {
        when(controlHeaders.find(any(Bson.class))).thenAnswer(invocation -> {
            String filter = ((Bson) invocation.getArgument(0)).toBsonDocument().toJson();
            FindIterable<Document> iterable = mock(DocumentFindIterable.class);
            when(iterable.projection(any())).thenReturn(iterable);

            if (filter.contains("controls")) {
                doAnswer(scan -> {
                    Consumer<Document> consumer = scan.getArgument(0);
                    documents.forEach(consumer);
                    return null;
                }).when(iterable).forEach(any());
                return iterable;
            }

            Document match = documents.stream()
                    .filter(document -> filter.contains(String.valueOf(document.get("_id"))))
                    .findFirst()
                    .orElse(null);
            when(iterable.first()).thenReturn(match);
            return iterable;
        });
    }

    /** One old-shape domain document holding one control with two requirement versions and one configuration. */
    private static Document oldDomainDocument() {
        Document config = new Document("configurationId", 10)
                .append("name", "cfg-name")
                .append("versions", new Document("1-0-0", new Document("setting", "enabled")));
        Document control = new Document("controlId", 1)
                .append("name", "Access Control")
                .append("description", "A description")
                .append("requirement", new Document("1-0-0", new Document("type", "req"))
                        .append("1-1-0", new Document("type", "req-v1.1")))
                .append("configurations", List.of(config));
        return new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(control));
    }

    private static MongoCommandException commandException(int code, String message) {
        BsonDocument response = new BsonDocument("ok", new BsonInt32(0))
                .append("code", new BsonInt32(code))
                .append("errmsg", new BsonString(message));
        return new MongoCommandException(response, new ServerAddress());
    }

    @Test
    void run_at_schema_version_thirteen() {
        assertThat(step.fromVersion(), is(13));
    }

    // --- index transition ---

    @Test
    void drop_the_one_document_per_domain_index_before_creating_the_four_new_ones() {
        step.apply();

        verify(controlHeaders).dropIndex("domain_1");
        verify(controlHeaders).createIndex(eq(new Document("namespace", 1).append("controlId", 1)), any());
        verify(controlVersions).createIndex(
                eq(new Document("namespace", 1).append("controlId", 1).append("version", 1)), any());
        verify(configHeaders).createIndex(eq(new Document("namespace", 1).append("configurationId", 1)), any());
        verify(configVersions).createIndex(
                eq(new Document("namespace", 1).append("configurationId", 1).append("version", 1)), any());
    }

    @Test
    void tolerate_the_old_index_already_being_absent() {
        doThrow(commandException(27, "index not found with name [domain_1]"))
                .when(controlHeaders).dropIndex(anyString());

        assertDoesNotThrow(() -> step.apply());
        verify(controlHeaders).createIndex(eq(new Document("namespace", 1).append("controlId", 1)), any());
    }

    @Test
    void propagate_index_drop_failures_that_are_not_a_missing_index() {
        doThrow(commandException(13, "not authorized")).when(controlHeaders).dropIndex(anyString());

        assertThrows(MongoCommandException.class, () -> step.apply());
    }

    // --- fan-out: requirement level ---

    @Test
    void write_one_control_header_per_control_with_a_counted_version_total() {
        stubOldDocuments(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        Document header = captor.getValue();
        assertThat(header.getString("namespace"), is("security"));
        assertThat(header.getInteger("controlId"), is(1));
        assertThat(header.getString("name"), is("Access Control"));
        assertThat(header.getInteger("versionCount"), is(2));
    }

    @Test
    void write_one_requirement_version_document_per_stored_version_with_dot_separated_keys() {
        stubOldDocuments(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions, Mockito.times(2))
                .replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        assertThat(captor.getAllValues().stream().map(d -> d.getString("version")).toList(),
                contains("1.0.0", "1.1.0"));
        assertThat(captor.getAllValues().get(0).get("content", Document.class),
                is(new Document("type", "req")));
    }

    @Test
    void collapse_two_requirement_keys_that_mean_the_same_version_into_one_document() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(new Document("controlId", 1)
                        .append("requirement", new Document("1-0-0", new Document("keep", true))
                                .append("100", new Document("discard", true)))
                        .append("configurations", List.of())))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).replaceOne(any(Bson.class), versionCaptor.capture(), any(ReplaceOptions.class));
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", Document.class), is(new Document("keep", true)));
    }

    @Test
    void migrate_requirement_content_that_is_not_a_document_rather_than_aborting_the_run() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(new Document("controlId", 1)
                        .append("requirement", new Document("1-0-0", "a bare string"))
                        .append("configurations", List.of())))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).replaceOne(any(Bson.class), versionCaptor.capture(), any(ReplaceOptions.class));
        assertThat(versionCaptor.getValue().get("content"), is("a bare string"));
    }

    @Test
    void write_a_control_header_but_no_requirement_versions_for_a_control_that_has_none() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(new Document("controlId", 9).append("name", "Empty")))));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        assertThat(captor.getValue().getInteger("versionCount"), is(0));
        verify(controlVersions, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    // --- fan-out: configuration level ---

    @Test
    void write_a_configuration_header_under_the_composite_domain_and_control_namespace() {
        stubOldDocuments(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).replaceOne(any(Bson.class), captor.capture(), any(ReplaceOptions.class));
        Document header = captor.getValue();
        assertThat(header.getString("namespace"), is("security::1"));
        assertThat(header.getInteger("configurationId"), is(10));
        assertThat(header.getString("name"), is("cfg-name"));
        assertThat(header.getInteger("versionCount"), is(1));
    }

    @Test
    void write_one_configuration_version_document_under_the_composite_namespace() {
        stubOldDocuments(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).replaceOne(any(Bson.class), versionCaptor.capture(), any(ReplaceOptions.class));
        assertThat(versionCaptor.getValue().getString("namespace"), is("security::1"));
        assertThat(versionCaptor.getValue().getInteger("configurationId"), is(10));
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", Document.class),
                is(new Document("setting", "enabled")));
    }

    @Test
    void collapse_two_configuration_keys_that_mean_the_same_version_into_one_document() {
        Document config = new Document("configurationId", 10)
                .append("versions", new Document("1-0-0", new Document("keep", true))
                        .append("100", new Document("discard", true)));
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(new Document("controlId", 1)
                        .append("requirement", new Document())
                        .append("configurations", List.of(config))))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).replaceOne(any(Bson.class), versionCaptor.capture(), any(ReplaceOptions.class));
        assertThat(versionCaptor.getValue().getString("version"), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", Document.class), is(new Document("keep", true)));
    }

    @Test
    void write_no_configuration_documents_for_a_control_with_no_configurations() {
        stubOldDocuments(List.of(new Document("_id", "abc")
                .append("domain", "security")
                .append("controls", List.of(new Document("controlId", 1)
                        .append("requirement", new Document())
                        .append("configurations", List.of())))));

        step.apply();

        verify(configHeaders, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        verify(configVersions, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
    }

    // --- ordering / idempotency ---

    @Test
    void delete_the_old_domain_document_only_after_rewriting_both_levels() {
        stubOldDocuments(List.of(oldDomainDocument()));

        step.apply();

        InOrder order = inOrder(controlHeaders, controlVersions, configHeaders, configVersions);
        order.verify(controlHeaders).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        order.verify(controlVersions, Mockito.atLeastOnce())
                .replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        order.verify(configHeaders).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        order.verify(configVersions).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        // A crash before this point leaves the source intact and the whole domain is redone.
        order.verify(controlHeaders).deleteOne(any(Bson.class));
    }

    @Test
    void build_the_new_unique_indexes_only_after_every_old_domain_document_is_fanned_out() {
        // Regression test: old-shape control documents have neither "namespace" nor
        // "controlId" — unlike MongoVersionSplitMigration's old shape, which at least shares
        // the "namespace" field name with the new index. Building controls.(namespace,
        // controlId) unique while two or more old-shape documents still exist means every one
        // of them collides on (null, null), and Mongo rejects the index build outright. The
        // new indexes must only be created once no old-shape document remains.
        Document second = new Document("_id", "def")
                .append("domain", "network")
                .append("controls", List.of(new Document("controlId", 2)
                        .append("requirement", new Document("1-0-0", new Document()))
                        .append("configurations", List.of())));
        stubOldDocuments(List.of(oldDomainDocument(), second));

        step.apply();

        InOrder order = inOrder(controlHeaders);
        order.verify(controlHeaders, Mockito.times(2)).deleteOne(any(Bson.class));
        order.verify(controlHeaders).createIndex(any(Document.class), any());
    }

    @Test
    void do_nothing_to_a_collection_that_holds_only_headers() {
        stubOldDocuments(List.of());

        step.apply();

        verify(controlHeaders, never()).replaceOne(any(Bson.class), any(Document.class), any(ReplaceOptions.class));
        verify(controlHeaders, never()).deleteOne(any(Bson.class));
    }

    @Test
    void transition_indexes_without_fanning_anything_out() {
        step.transitionIndexes();

        verify(controlHeaders).createIndex(eq(new Document("namespace", 1).append("controlId", 1)), any());
        verify(controlHeaders, never()).deleteOne(any(Bson.class));
    }

    @Test
    void skip_the_whole_step_when_not_running_against_mongo() {
        step.databaseMode = "standalone";

        step.apply();

        verify(controlHeaders, never()).dropIndex(anyString());
        verify(controlHeaders, never()).createIndex(any(Bson.class), any());
    }
}
