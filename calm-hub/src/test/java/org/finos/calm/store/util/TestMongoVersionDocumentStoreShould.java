package org.finos.calm.store.util;

import com.mongodb.MongoTimeoutException;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import org.bson.BsonDocument;
import org.bson.BsonObjectId;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
import org.finos.calm.domain.exception.StorageWriteException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestMongoVersionDocumentStoreShould {

    private static final String NAMESPACE = "finos";
    private static final int RESOURCE_ID = 42;
    private static final String ID_FIELD = "architectureId";
    private static final String LABEL = "Architecture";

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoVersionDocumentStore store;

    @BeforeEach
    void setup() {
        headerCollection = mock(DocumentMongoCollection.class);
        versionCollection = mock(DocumentMongoCollection.class);
        store = new MongoVersionDocumentStore(headerCollection, versionCollection, ID_FIELD, LABEL);
    }

    /** A find(...) chain that yields the given documents when iterated, and the first on first(). */
    private FindIterable<Document> stubFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> iterable = mock(DocumentFindIterable.class);
        when(collection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.sort(any())).thenReturn(iterable);
        when(iterable.skip(anyInt())).thenReturn(iterable);
        when(iterable.limit(anyInt())).thenReturn(iterable);
        when(iterable.first()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            documents.forEach(consumer);
            return null;
        }).when(iterable).forEach(any());
        return iterable;
    }

    /**
     * Renders a captured filter as JSON, so assertions about what it matches on don't
     * depend on how {@code Filters.and(...)} happens to nest its operands.
     */
    private static String asJson(Bson filter) {
        return filter.toBsonDocument().toJson();
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
    }

    private static Document header(Integer id, String name, String description, Integer versionCount) {
        Document header = new Document(ID_FIELD, id);
        if (name != null) header.append("name", name);
        if (description != null) header.append("description", description);
        if (versionCount != null) header.append("versionCount", versionCount);
        return header;
    }

    /**
     * A real {@link UpdateResult} rather than a mock — building one inside a
     * {@code when(...)} argument would nest stubbing and fail.
     */
    private static UpdateResult acknowledged(int matched, BsonObjectId upsertedId) {
        return UpdateResult.acknowledged(matched, (long) matched, upsertedId);
    }

    // --- headerExists ---

    @Test
    void report_a_resource_exists_when_its_header_is_present() {
        stubFind(headerCollection, List.of(new Document("_id", new ObjectId())));

        assertThat(store.headerExists(NAMESPACE, RESOURCE_ID), is(true));
    }

    @Test
    void report_a_resource_does_not_exist_when_no_header_is_present() {
        stubFind(headerCollection, List.of());

        assertThat(store.headerExists(NAMESPACE, RESOURCE_ID), is(false));
    }

    // --- createHeader ---

    @Test
    void create_a_header_with_a_zero_version_count_and_empty_metadata() {
        store.createHeader(NAMESPACE, RESOURCE_ID, "My Architecture", "A description");

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(headerCollection).insertOne(captor.capture());
        Document inserted = captor.getValue();
        assertThat(inserted.getString("namespace"), is(NAMESPACE));
        assertThat(inserted.getInteger(ID_FIELD), is(RESOURCE_ID));
        assertThat(inserted.getString("name"), is("My Architecture"));
        assertThat(inserted.getString("description"), is("A description"));
        assertThat(inserted.getInteger("versionCount"), is(0));
        assertThat(inserted.get("metadata", Document.class), is(new Document()));
    }

    @Test
    void translate_a_write_failure_when_creating_a_header() {
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(headerCollection).insertOne(any(Document.class));

        assertThrows(StorageWriteException.class,
                () -> store.createHeader(NAMESPACE, RESOURCE_ID, "name", "description"));
    }

    // --- deleteHeader ---

    @Test
    void delete_a_header_by_namespace_and_id() {
        store.deleteHeader(NAMESPACE, RESOURCE_ID);

        ArgumentCaptor<Bson> filterCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).deleteOne(filterCaptor.capture());
        assertThat(asJson(filterCaptor.getValue()), containsString(NAMESPACE));
    }

    @Test
    void swallow_a_failure_to_delete_a_header() {
        when(headerCollection.deleteOne(any(Bson.class))).thenThrow(new MongoTimeoutException("no server"));

        // The only caller is already failing a create. Propagating this would replace the
        // real write failure with a misleading one about the cleanup.
        assertDoesNotThrow(() -> store.deleteHeader(NAMESPACE, RESOURCE_ID));
    }

    // --- createVersion ---

    @Test
    void create_a_version_and_increment_the_header_count() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        boolean created = store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document("nodes", List.of()));

        assertThat(created, is(true));
        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(captor.capture());
        Document inserted = captor.getValue();
        assertThat(inserted.getString("version"), is("1.0.0"));
        assertThat(inserted.get("content", Document.class), is(new Document("nodes", List.of())));
        assertThat(inserted.get("metadata", Document.class), is(new Document()));
        verify(headerCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void store_a_dash_spelled_version_under_its_canonical_form() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        // 1-0-0 and 1.0.0 are both accepted by VERSION_REGEX. The old shape folded them
        // together via replace('.', '-') on the map key; storing the version as a field
        // value means they have to be folded here or the same version gets two documents.
        store.createVersion(NAMESPACE, RESOURCE_ID, "1-0-0", new Document());

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(captor.capture());
        assertThat(captor.getValue().getString("version"), is("1.0.0"));
    }

    @Test
    void report_a_version_already_exists_rather_than_overwriting_it() {
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        boolean created = store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document());

        assertThat(created, is(false));
        // The count must not move when nothing was written.
        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void translate_a_non_duplicate_write_failure_when_creating_a_version() {
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(StorageWriteException.class,
                () -> store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()));
    }

    @Test
    void warn_but_still_succeed_when_a_version_has_no_header_to_count_it() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(0, null));

        // The version content is already stored, so an orphaned count is not worth failing over.
        assertThat(store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()), is(true));
    }

    @Test
    void still_succeed_when_the_count_update_itself_fails_after_creating_a_version() {
        // The version document is durably stored by the time the count is touched. Failing
        // here would report failure for a write that succeeded, and a caller retrying that
        // "failure" would then be told the version already exists. ADR 0001 accepts an
        // understated count as the cost.
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenThrow(writeError(10107, "not master"));

        assertThat(store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()), is(true));
        verify(versionCollection).insertOne(any(Document.class));
    }

    @Test
    void still_succeed_when_the_count_update_fails_with_a_non_write_driver_error() {
        // Not every driver failure is a MongoWriteException — a timeout or socket error
        // reaching the header collection must be tolerated the same way.
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenThrow(new MongoTimeoutException("timed out selecting a server"));

        assertThat(store.createVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()), is(true));
    }

    // --- createFirstVersion ---

    @Test
    void create_the_first_version_of_a_new_resource() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        store.createFirstVersion(NAMESPACE, RESOURCE_ID, new Document("nodes", List.of()));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(captor.capture());
        assertThat(captor.getValue().getString("version"), is("1.0.0"));
        verify(headerCollection, never()).deleteOne(any(Bson.class));
    }

    @Test
    void remove_the_header_again_when_the_first_version_write_fails() {
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        // No endpoint can delete a header, so one stranded by a failed first version write
        // would show up in listings and search with versionCount 0 forever.
        assertThrows(StorageWriteException.class,
                () -> store.createFirstVersion(NAMESPACE, RESOURCE_ID, new Document()));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    @Test
    void fail_rather_than_report_success_when_the_first_version_already_exists() {
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        // createVersion reports a duplicate as false. For an id the counter has just issued
        // that is a storage inconsistency rather than a normal conflict, and reporting
        // success would return 201 for content that was never stored.
        assertThrows(StorageWriteException.class,
                () -> store.createFirstVersion(NAMESPACE, RESOURCE_ID, new Document()));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- upsertVersion ---

    @Test
    void increment_the_version_count_when_an_upsert_inserts_a_new_version() {
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(acknowledged(0, new BsonObjectId(new ObjectId())));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document());

        verify(headerCollection).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void still_succeed_when_the_count_update_fails_after_an_upsert_inserts() {
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(acknowledged(0, new BsonObjectId(new ObjectId())));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenThrow(writeError(10107, "not master"));

        // Same reasoning as createVersion: the version is stored, so the count is
        // follow-up work and must not turn a successful write into a failure.
        assertDoesNotThrow(() -> store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()));
    }

    @Test
    void not_increment_the_version_count_when_an_upsert_replaces_an_existing_version() {
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(acknowledged(1, null));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document());

        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void address_the_canonical_document_when_upserting_a_dash_spelled_version() {
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenReturn(acknowledged(1, null));

        store.upsertVersion(NAMESPACE, RESOURCE_ID, "1-0-0", new Document());

        // The upsert filter has to carry the canonical form: on insert, Mongo derives the
        // new document's fields from the filter's equality conditions, so a dash-spelled
        // filter would both miss the existing document and create a duplicate.
        ArgumentCaptor<Bson> filterCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(versionCollection).updateOne(filterCaptor.capture(), any(Bson.class), any(UpdateOptions.class));
        assertThat(asJson(filterCaptor.getValue()), containsString("1.0.0"));
    }

    @Test
    void translate_a_write_failure_when_upserting_a_version() {
        when(versionCollection.updateOne(any(Bson.class), any(Bson.class), any(UpdateOptions.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        assertThrows(StorageWriteException.class,
                () -> store.upsertVersion(NAMESPACE, RESOURCE_ID, "1.0.0", new Document()));
    }

    // --- updateHeaderDetails ---

    @Test
    void overwrite_the_headers_name_and_description() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "A new description");

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        String update = asJson(updateCaptor.getValue());
        assertThat(update, containsString("Renamed"));
        assertThat(update, containsString("A new description"));
    }

    @Test
    void let_a_null_name_overwrite_a_stored_one() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        // Faithful to the old shape, which $set both fields unconditionally: a version
        // write carrying no name wipes the display name. ArchitectureRequest validates
        // neither field, so this is reachable from the API — logged as a known bug rather
        // than quietly fixed here, since fixing it is a behaviour change, not a port.
        store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, null, null);

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        assertThat(asJson(updateCaptor.getValue()), containsString("null"));
    }

    @Test
    void warn_rather_than_throw_when_there_is_no_header_to_update_details_on() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(0, null));

        assertDoesNotThrow(() -> store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d"));
    }

    @Test
    void translate_a_write_failure_when_updating_header_details() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        // Unlike the versionCount write, this is user-supplied data — dropping a rename
        // silently would be a wrong answer, not a stale display number.
        assertThrows(StorageWriteException.class,
                () -> store.updateHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d"));
    }

    // --- updatePresentHeaderDetails ---

    @Test
    void update_only_the_header_details_that_are_present() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        // Pattern guarded these fields where Architecture overwrote them unconditionally,
        // so both behaviours have to exist — see the javadoc on why that is a real
        // difference between the types rather than a style choice.
        store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "   ");

        ArgumentCaptor<Bson> updateCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(headerCollection).updateOne(any(Bson.class), updateCaptor.capture());
        String update = asJson(updateCaptor.getValue());
        assertThat(update, containsString("Renamed"));
        // A blank description must not reach the document.
        assertThat(update, not(containsString("description")));
    }

    @Test
    void write_nothing_when_no_header_details_are_present() {
        store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, null, null);

        // Not merely a no-op update: issuing one would touch the document for no reason.
        verify(headerCollection, never()).updateOne(any(Bson.class), any(Bson.class));
    }

    @Test
    void warn_rather_than_throw_when_there_is_no_header_to_update_present_details_on() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(0, null));

        assertDoesNotThrow(() -> store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d"));
    }

    @Test
    void translate_a_write_failure_when_updating_present_header_details() {
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenThrow(writeError(10334, "object to insert too large"));

        assertThrows(StorageWriteException.class,
                () -> store.updatePresentHeaderDetails(NAMESPACE, RESOURCE_ID, "Renamed", "d"));
    }

    // --- getVersion ---

    @Test
    void return_the_content_of_a_stored_version() {
        Document content = new Document("title", "My Architecture");
        stubFind(versionCollection, List.of(new Document("version", "1.0.0").append("content", content)));

        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "1.0.0"), is(content));
    }

    @Test
    void return_null_when_a_version_is_not_stored() {
        stubFind(versionCollection, List.of());

        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "9.9.9"), is(nullValue()));
    }

    @Test
    void look_up_a_dash_spelled_version_by_its_canonical_form() {
        Document content = new Document("title", "My Architecture");
        stubFind(versionCollection, List.of(new Document("version", "1.0.0").append("content", content)));

        // Reads have to canonicalise too, or a version written as 1.0.0 would be
        // unreadable via the equally-valid 1-0-0 spelling of the same path.
        assertThat(store.getVersion(NAMESPACE, RESOURCE_ID, "1-0-0"), is(content));

        ArgumentCaptor<Bson> filterCaptor = ArgumentCaptor.forClass(Bson.class);
        verify(versionCollection).find(filterCaptor.capture());
        assertThat(asJson(filterCaptor.getValue()), containsString("1.0.0"));
    }

    // --- listVersions ---

    @Test
    void list_versions_in_semantic_order_rather_than_stored_order() {
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0"),
                new Document("version", "1.0.0")));

        assertThat(store.listVersions(NAMESPACE, RESOURCE_ID), contains("1.0.0", "1.9.0", "1.10.0"));
    }

    @Test
    void return_no_versions_for_a_resource_that_has_none() {
        stubFind(versionCollection, List.of());

        // Empty means "no versions", never "no such resource" — that's headerExists' job.
        assertThat(store.listVersions(NAMESPACE, RESOURCE_ID), is(empty()));
    }

    // --- getLatestVersion / getLatestVersionContent ---

    @Test
    void resolve_the_latest_version_by_the_stores_own_ordering() {
        stubFind(versionCollection, List.of(
                new Document("version", "1.10.0"),
                new Document("version", "1.9.0")));

        // Ranked in memory, not by a database sort: the stored values are strings, so Mongo
        // would rank 1.10.0 below 1.9.0.
        assertThat(store.getLatestVersion(NAMESPACE, RESOURCE_ID), is("1.10.0"));
    }

    @Test
    void return_no_latest_version_for_a_resource_with_none() {
        stubFind(versionCollection, List.of());

        assertThat(store.getLatestVersion(NAMESPACE, RESOURCE_ID), is(nullValue()));
    }

    @Test
    void store_a_numeric_revision_verbatim_rather_than_canonicalising_it() {
        MongoVersionDocumentStore numericStore = new MongoVersionDocumentStore(
                headerCollection, versionCollection, ID_FIELD, LABEL, VersionScheme.NUMERIC);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class))).thenReturn(acknowledged(1, null));

        // VERSION_REGEX makes both separators optional, so "100" is one of the six accepted
        // spellings of 1.0.0. Canonicalising it would store ADR revision 100 as "1.0.0",
        // which NumericVersionOrder then sorts BELOW 99 — the latest-revision read every ADR
        // goes through would return revision 99's content while 100 exists — and which
        // MongoAdrStore.getAdrRevisions cannot Integer.parseInt. Revisions 1-99 are
        // unaffected, which is exactly why this went unnoticed.
        numericStore.createVersion(NAMESPACE, RESOURCE_ID, "100", new Document());

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(captor.capture());
        assertThat(captor.getValue().getString("version"), is("100"));
    }

    @Test
    void rank_a_numeric_revision_above_a_smaller_one_that_is_three_digits() {
        MongoVersionDocumentStore numericStore = new MongoVersionDocumentStore(
                headerCollection, versionCollection, ID_FIELD, LABEL, VersionScheme.NUMERIC);
        stubFind(versionCollection, List.of(
                new Document("version", "99"),
                new Document("version", "100")));

        assertThat(numericStore.getLatestVersion(NAMESPACE, RESOURCE_ID), is("100"));
    }

    @Test
    void resolve_the_latest_version_numerically_when_told_to() {
        MongoVersionDocumentStore numericStore = new MongoVersionDocumentStore(
                headerCollection, versionCollection, ID_FIELD, LABEL, VersionScheme.NUMERIC);
        stubFind(versionCollection, List.of(
                new Document("version", "2"),
                new Document("version", "10")));

        // ADR's revisions are integers; the semantic comparator would call 2 the latest.
        assertThat(numericStore.getLatestVersion(NAMESPACE, RESOURCE_ID), is("10"));
    }

    @Test
    void return_no_latest_content_for_a_resource_with_no_versions() {
        stubFind(versionCollection, List.of());

        assertThat(store.getLatestVersionContent(NAMESPACE, RESOURCE_ID), is(nullValue()));
    }

    @Test
    void return_the_content_of_the_latest_version() {
        Document content = new Document("title", "Latest");
        stubFind(versionCollection, List.of(
                new Document("version", "2.0.0").append("content", content)));

        assertThat(store.getLatestVersionContent(NAMESPACE, RESOURCE_ID), is(content));
    }

    // --- listSummariesPaged ---

    @Test
    void list_summaries_for_a_namespace() {
        stubFind(headerCollection, List.of(
                header(1, "First", "First description", 2),
                header(2, "Second", "Second description", 0)));

        List<NamespaceResourceSummary> summaries = store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED);

        assertThat(summaries, contains(
                new NamespaceResourceSummary("First", "First description", 1, 2),
                new NamespaceResourceSummary("Second", "Second description", 2, 0)));
    }

    @Test
    void push_the_paging_window_down_to_the_database() {
        FindIterable<Document> iterable = stubFind(headerCollection, List.of(header(2, "Second", "d", 1)));

        store.listSummariesPaged(NAMESPACE, new PageRequest(1, 1));

        verify(iterable).skip(1);
        verify(iterable).limit(1);
    }

    @Test
    void not_apply_a_paging_window_when_unpaged() {
        FindIterable<Document> iterable = stubFind(headerCollection, List.of(header(1, "First", "d", 1)));

        store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED);

        verify(iterable, never()).skip(anyInt());
        verify(iterable, never()).limit(anyInt());
    }

    @Test
    void fall_back_to_a_generated_name_and_blank_description_when_a_header_has_neither() {
        // Headers migrated from the old shape can lack both, which must not produce nulls.
        stubFind(headerCollection, List.of(header(7, null, null, null)));

        assertThat(store.listSummariesPaged(NAMESPACE, PageRequest.UNPAGED),
                contains(new NamespaceResourceSummary("Architecture 7", "", 7, 0)));
    }
}
