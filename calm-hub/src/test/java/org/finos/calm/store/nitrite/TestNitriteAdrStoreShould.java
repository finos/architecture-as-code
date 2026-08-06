package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Store-level tests for ADR on the header/version shape. Mirrors the Mongo class: integer
 * revisions and a summary built from the latest revision's content, with content held as a
 * JSON string in this backend.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class TestNitriteAdrStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    @Mock
    private NitriteCounterStore mockCounterStore;

    private NitriteCollection headerCollection;
    private NitriteCollection versionCollection;
    private NitriteAdrStore store;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private static final String NAMESPACE = "finos";
    private static final int ADR_ID = 42;

    @BeforeEach
    public void setup() {
        headerCollection = mock(NitriteCollection.class);
        versionCollection = mock(NitriteCollection.class);

        when(mockDb.getCollection("adrs")).thenReturn(headerCollection);
        when(mockDb.getCollection("adrVersions")).thenReturn(versionCollection);
        when(mockNamespaceStore.namespaceExists(anyString())).thenReturn(true);

        store = new NitriteAdrStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    private void stubFind(NitriteCollection collection, List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(collection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(documents.isEmpty() ? null : documents.get(0));
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(cursor.size()).thenReturn((long) documents.size());
        when(collection.find()).thenReturn(cursor);
    }

    private void adrExists() {
        stubFind(headerCollection, List.of(Document.createDocument().put("adrId", ADR_ID)));
    }

    private void adrDoesNotExist() {
        stubFind(headerCollection, List.of());
    }

    private static Adr adr(String title, Status status) {
        return new Adr.AdrBuilder().setTitle(title).setStatus(status).build();
    }

    private String contentOf(String title, Status status) throws Exception {
        return objectMapper.writeValueAsString(adr(title, status));
    }

    private static AdrMeta adrMeta(int revision, Adr adr) {
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE).setId(ADR_ID).setRevision(revision).setAdr(adr).build();
    }

    /**
     * Stubs an update: the latest revision reads back, then the existence check that
     * {@code createVersion} performs before inserting finds nothing, because the revision
     * being written is new. A single always-returns-content stub would make that check see
     * the existing revision and refuse the write — this backend inserts by check-then-insert,
     * where Mongo inserts optimistically and translates a duplicate-key error.
     */
    private void stubRevisionsForUpdate(List<String> revisions, String latestContent) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(versionCollection.find(any(Filter.class))).thenReturn(cursor);
        java.util.concurrent.atomic.AtomicBoolean firstRead = new java.util.concurrent.atomic.AtomicBoolean(true);
        when(cursor.firstOrNull()).thenAnswer(invocation ->
                firstRead.getAndSet(false) ? Document.createDocument().put("content", latestContent) : null);
        when(cursor.iterator()).thenAnswer(invocation ->
                revisions.stream().map(r -> Document.createDocument().put("version", r)).iterator());
    }

    /** Revision documents as listVersions sees them, plus the content getVersion returns. */
    private void stubRevisions(List<String> revisions, String latestContent) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(versionCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(
                latestContent == null ? null : Document.createDocument().put("content", latestContent));
        when(cursor.iterator()).thenAnswer(invocation ->
                revisions.stream().map(r -> Document.createDocument().put("version", r)).iterator());
    }

    // --- getAdrsForNamespace ---

    @Test
    public void throw_a_namespace_exception_when_listing_adrs_for_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrsForNamespace(NAMESPACE));
    }

    @Test
    public void return_an_empty_list_when_a_namespace_has_no_adrs() throws NamespaceNotFoundException {
        stubFind(headerCollection, List.of());

        assertThat(store.getAdrsForNamespace(NAMESPACE), is(empty()));
    }

    @Test
    public void build_the_summary_from_the_latest_revisions_title_and_status() throws Exception {
        stubFind(headerCollection, List.of(Document.createDocument().put("adrId", ADR_ID)));
        stubRevisions(List.of("1", "2"), contentOf("Use Event Sourcing", Status.accepted));

        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("Use Event Sourcing", "accepted", ADR_ID)));
    }

    @Test
    public void fall_back_to_placeholders_rather_than_failing_on_unreadable_content() throws Exception {
        stubFind(headerCollection, List.of(Document.createDocument().put("adrId", 7)));
        stubRevisions(List.of("1"), "{not valid json");

        // A listing must not fail because one ADR's stored content is unreadable.
        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("ADR 7", "unknown", 7)));
    }

    @Test
    public void render_a_header_with_no_id_rather_than_failing_the_whole_listing() throws Exception {
        stubFind(headerCollection, List.of(Document.createDocument().put("adrId", null)));

        // The helper sorts null ids last so one malformed header does not fail the listing;
        // resolving its latest revision unboxes that null into an int parameter.
        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("ADR null", "unknown", null)));
    }

    @Test
    public void count_adrs_without_resolving_any_revision() throws Exception {
        stubFind(headerCollection, List.of(
                Document.createDocument().put("adrId", 1),
                Document.createDocument().put("adrId", 2)));

        assertThat(store.countAdrsForNamespace(NAMESPACE), is(2));
        verifyNoInteractions(versionCollection);
    }

    @Test
    public void throw_a_namespace_exception_when_counting_adrs_in_a_missing_namespace() {
        when(mockNamespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> store.countAdrsForNamespace(NAMESPACE));
    }

    // --- createAdrForNamespace ---

    @Test
    public void create_a_header_and_the_first_revision() throws Exception {
        when(mockCounterStore.getNextAdrSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of(Document.createDocument().put("adrId", 99).put("versionCount", 0)));
        stubRevisions(List.of(), null);

        AdrMeta created = store.createAdrForNamespace(adrMeta(1, adr("New", Status.draft)));

        assertThat(created.getId(), is(99));

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(versionCollection).insert(captor.capture());
        assertThat(captor.getValue().get("version", String.class), is("1"));
    }

    // --- reads ---

    @Test
    public void throw_an_adr_exception_when_the_adr_is_missing() {
        adrDoesNotExist();

        assertThrows(AdrNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    public void resolve_the_latest_revision_numerically_rather_than_lexicographically() throws Exception {
        adrExists();
        stubRevisions(List.of("2", "10"), contentOf("Latest", Status.accepted));

        assertThat(store.getAdr(adrMeta(1, null)).getRevision(), is(10));
    }

    @Test
    public void throw_a_revision_exception_when_an_adr_has_no_revisions() {
        adrExists();
        stubRevisions(List.of(), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    public void list_revisions_as_ascending_integers() throws Exception {
        adrExists();
        stubRevisions(List.of("10", "2", "1"), contentOf("t", Status.draft));

        assertThat(store.getAdrRevisions(adrMeta(1, null)), contains(1, 2, 10));
    }

    @Test
    public void return_a_specific_revision() throws Exception {
        adrExists();
        stubRevisions(List.of("1"), contentOf("Specific", Status.proposed));

        assertThat(store.getAdrRevision(adrMeta(1, null)).getAdr().getTitle(), is("Specific"));
    }

    @Test
    public void throw_a_revision_exception_when_the_requested_revision_is_missing() {
        adrExists();
        stubRevisions(List.of("1"), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdrRevision(adrMeta(9, null)));
    }

    @Test
    public void report_a_parse_failure_when_stored_content_is_not_a_readable_adr() {
        adrExists();
        stubRevisions(List.of("1"), "{\"title\": 42, \"status\": \"nonsense\"}");

        assertThrows(org.finos.calm.domain.exception.AdrParseException.class,
                () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    public void report_a_missing_revision_when_the_latest_disappears_between_resolving_and_reading() {
        adrExists();
        stubRevisions(List.of("1"), null);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdr(adrMeta(1, null)));
    }

    @Test
    public void remove_the_header_when_the_first_revision_already_exists_for_a_fresh_id() throws Exception {
        when(mockCounterStore.getNextAdrSequenceValue()).thenReturn(99);
        stubFind(headerCollection, List.of());
        stubRevisions(List.of("1"), contentOf("Existing", Status.draft));

        assertThrows(org.finos.calm.domain.exception.StorageWriteException.class,
                () -> store.createAdrForNamespace(adrMeta(1, adr("New", Status.draft))));

        verify(headerCollection).remove(any(Filter.class));
    }

    // --- updates ---

    @Test
    public void write_the_next_revision_when_updating_an_adr() throws Exception {
        adrExists();
        stubRevisionsForUpdate(List.of("1", "2"), contentOf("Existing", Status.accepted));

        AdrMeta updated = store.updateAdrForNamespace(adrMeta(1, adr("Rewritten", Status.draft)));

        assertThat(updated.getRevision(), is(3));
        // Status comes from the stored latest revision, not the request.
        assertThat(updated.getAdr().getStatus(), is(Status.accepted));
    }

    @Test
    public void write_the_next_revision_when_updating_status() throws Exception {
        adrExists();
        stubRevisionsForUpdate(List.of("1"), contentOf("Existing", Status.draft));

        AdrMeta updated = store.updateAdrStatus(adrMeta(1, null), Status.accepted);

        assertThat(updated.getRevision(), is(2));
        assertThat(updated.getAdr().getStatus(), is(Status.accepted));
    }

    @Test
    public void report_the_revision_already_exists_when_two_writers_race() throws Exception {
        adrExists();
        // The revision the update computes is already present, so createVersion refuses it.
        stubRevisions(List.of("1"), contentOf("Existing", Status.draft));
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(versionCollection.find(any(Filter.class))).thenReturn(cursor);
        when(cursor.firstOrNull()).thenReturn(
                Document.createDocument().put("content", contentOf("Existing", Status.draft)));
        when(cursor.iterator()).thenAnswer(invocation ->
                List.of(Document.createDocument().put("version", "1")).iterator());

        assertThrows(AdrRevisionExistsException.class,
                () -> store.updateAdrStatus(adrMeta(1, null), Status.accepted));
    }
}
