package org.finos.calm.store.mongo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.result.UpdateResult;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;
import java.util.function.Consumer;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Store-level tests for ADR on the header/version shape. ADR is the one type whose history is
 * an integer revision rather than a semantic version, and whose summary comes from the latest
 * revision's content rather than from the entity — both are pinned here.
 */
@QuarkusTest
public class TestMongoAdrStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;

    @InjectMock
    MongoCounterStore counterStore;

    @InjectMock
    MongoNamespaceStore namespaceStore;

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private MongoCollection<Document> headerCollection;
    private MongoCollection<Document> versionCollection;
    private MongoAdrStore store;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private static final String NAMESPACE = "finos";
    private static final int ADR_ID = 42;

    @BeforeEach
    void setup() {
        headerCollection = Mockito.mock(DocumentMongoCollection.class);
        versionCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("adrs")).thenReturn(headerCollection);
        when(mongoDatabase.getCollection("adrVersions")).thenReturn(versionCollection);
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new MongoAdrStore(mongoDatabase, counterStore, namespaceStore);
    }

    private void stubFind(MongoCollection<Document> collection, List<Document> documents) {
        FindIterable<Document> iterable = Mockito.mock(DocumentFindIterable.class);
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
    }

    private void adrExists() {
        stubFind(headerCollection, List.of(new Document("adrId", ADR_ID)));
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    }

    private void adrDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static MongoWriteException writeError(int code, String message) {
        return new MongoWriteException(new WriteError(code, message, new BsonDocument()), new ServerAddress(), List.of());
    }

    private static Adr adr(String title, Status status) {
        return new Adr.AdrBuilder().setTitle(title).setStatus(status).build();
    }

    private Document contentOf(String title, Status status) throws Exception {
        return Document.parse(objectMapper.writeValueAsString(adr(title, status)));
    }

    private static AdrMeta adrMeta(int revision, Adr adr) {
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE).setId(ADR_ID).setRevision(revision).setAdr(adr).build();
    }

    /** Version documents as listVersions sees them, plus the content getVersion returns. */
    private void stubRevisions(List<String> revisions, Document latestContent) {
        FindIterable<Document> iterable = Mockito.mock(DocumentFindIterable.class);
        when(versionCollection.find(any(Bson.class))).thenReturn(iterable);
        when(iterable.projection(any())).thenReturn(iterable);
        when(iterable.first()).thenReturn(latestContent == null ? null : new Document("content", latestContent));
        doAnswer(invocation -> {
            Consumer<Document> consumer = invocation.getArgument(0);
            revisions.forEach(revision -> consumer.accept(new Document("version", revision)));
            return null;
        }).when(iterable).forEach(any());
    }

    // --- getAdrsForNamespace ---

    @Test
    void throw_a_namespace_exception_when_listing_adrs_for_a_missing_namespace() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrsForNamespace(NAMESPACE));
    }

    @Test
    void return_an_empty_list_when_a_namespace_has_no_adrs() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getAdrsForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    void build_the_summary_from_the_latest_revisions_title_and_status() throws Exception {
        stubFind(headerCollection, List.of(new Document("adrId", ADR_ID)));
        stubRevisions(List.of("1", "2"), contentOf("Use Event Sourcing", Status.accepted));

        // Unlike every other type, none of this comes off the header — ADR has no name or
        // description of its own.
        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("Use Event Sourcing", "accepted", ADR_ID)));
    }

    @Test
    void fall_back_to_placeholders_when_an_adr_has_no_readable_revision() throws Exception {
        stubFind(headerCollection, List.of(new Document("adrId", 7)));
        stubRevisions(List.of(), null);

        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("ADR 7", "unknown", 7)));
    }

    // --- createAdrForNamespace ---

    @Test
    void create_a_header_and_the_first_revision() throws Exception {
        when(counterStore.getNextAdrSequenceValue()).thenReturn(99);
        when(headerCollection.updateOne(any(Bson.class), any(Bson.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        AdrMeta created = store.createAdrForNamespace(adrMeta(1, adr("New", Status.draft)));

        assertThat(created.getId(), is(99));

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(versionCaptor.capture());
        // Stored as the revision number, not a semantic version.
        assertThat(versionCaptor.getValue().getString("version"), is("1"));
    }

    @Test
    void remove_the_header_again_when_the_first_revision_write_fails() {
        when(counterStore.getNextAdrSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(10334, "object to insert too large");
        }).when(versionCollection).insertOne(any(Document.class));

        assertThrows(RuntimeException.class,
                () -> store.createAdrForNamespace(adrMeta(1, adr("New", Status.draft))));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- getAdr / getAdrRevisions / getAdrRevision ---

    @Test
    void throw_an_adr_exception_when_the_adr_is_missing() {
        adrDoesNotExist();

        assertThrows(AdrNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    void resolve_the_latest_revision_numerically_rather_than_lexicographically() throws Exception {
        adrExists();
        stubRevisions(List.of("2", "10"), contentOf("Latest", Status.accepted));

        // The whole reason ADR needed NumericVersionOrder: a string sort would call 2 the
        // latest, so every read resolving "latest" would return stale content.
        assertThat(store.getAdr(adrMeta(1, null)).getRevision(), is(10));
    }

    @Test
    void throw_a_revision_exception_when_an_adr_has_no_revisions() {
        adrExists();
        stubRevisions(List.of(), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    void list_revisions_as_ascending_integers() throws Exception {
        adrExists();
        stubRevisions(List.of("10", "2", "1"), contentOf("t", Status.draft));

        assertThat(store.getAdrRevisions(adrMeta(1, null)), contains(1, 2, 10));
    }

    @Test
    void throw_a_revision_exception_when_listing_revisions_of_an_adr_with_none() {
        adrExists();
        stubRevisions(List.of(), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdrRevisions(adrMeta(1, null)));
    }

    @Test
    void return_a_specific_revision() throws Exception {
        adrExists();
        stubRevisions(List.of("1"), contentOf("Specific", Status.proposed));

        assertThat(store.getAdrRevision(adrMeta(1, null)).getAdr().getTitle(), is("Specific"));
    }

    @Test
    void throw_a_revision_exception_when_the_requested_revision_is_missing() {
        adrExists();
        stubRevisions(List.of("1"), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdrRevision(adrMeta(9, null)));
    }

    @Test
    void report_a_parse_failure_when_stored_content_is_not_a_readable_adr() {
        adrExists();
        stubRevisions(List.of("1"), new Document("not-an-adr", true).append("title", 42));

        assertThrows(org.finos.calm.domain.exception.AdrParseException.class,
                () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    void report_a_missing_revision_when_the_latest_disappears_between_resolving_and_reading() {
        adrExists();
        // listVersions sees revision 1, but the content read comes back empty — the document
        // was removed in between. Reporting "no revision" is honest; returning null is not.
        stubRevisions(List.of("1"), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    void remove_the_header_when_the_first_revision_already_exists_for_a_fresh_id() {
        when(counterStore.getNextAdrSequenceValue()).thenReturn(99);
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        // A revision present for an id the counter just issued is a storage inconsistency,
        // not a normal "already exists".
        assertThrows(org.finos.calm.domain.exception.StorageWriteException.class,
                () -> store.createAdrForNamespace(adrMeta(1, adr("New", Status.draft))));

        verify(headerCollection).deleteOne(any(Bson.class));
    }

    // --- updateAdrForNamespace / updateAdrStatus ---

    @Test
    void write_the_next_revision_when_updating_an_adr() throws Exception {
        adrExists();
        stubRevisions(List.of("1", "2"), contentOf("Existing", Status.accepted));

        AdrMeta updated = store.updateAdrForNamespace(adrMeta(1, adr("Rewritten", Status.draft)));

        assertThat(updated.getRevision(), is(3));
        // Status and creation time come from the stored latest revision, not the request.
        assertThat(updated.getAdr().getStatus(), is(Status.accepted));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insertOne(captor.capture());
        assertThat(captor.getValue().getString("version"), is("3"));
    }

    @Test
    void write_the_next_revision_when_updating_status() throws Exception {
        adrExists();
        stubRevisions(List.of("1"), contentOf("Existing", Status.draft));

        AdrMeta updated = store.updateAdrStatus(adrMeta(1, null), Status.accepted);

        assertThat(updated.getRevision(), is(2));
        assertThat(updated.getAdr().getStatus(), is(Status.accepted));
    }

    @Test
    void report_the_revision_already_exists_when_two_writers_race() throws Exception {
        adrExists();
        stubRevisions(List.of("1"), contentOf("Existing", Status.draft));
        doAnswer(invocation -> {
            throw writeError(11000, "duplicate key");
        }).when(versionCollection).insertOne(any(Document.class));

        // Both update paths compute latest + 1, so two concurrent writers land on the same
        // number. The loser must be told, not silently overwrite the winner.
        assertThrows(AdrRevisionExistsException.class,
                () -> store.updateAdrStatus(adrMeta(1, null), Status.accepted));
    }
}
