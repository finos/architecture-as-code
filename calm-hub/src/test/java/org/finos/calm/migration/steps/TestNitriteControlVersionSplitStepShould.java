package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.filters.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NitriteDB counterpart to {@link TestMongoControlVersionSplitStepShould}: deep coverage of
 * {@link NitriteControlSplitMigration}'s two-level fan-out, exercised through the step.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestNitriteControlVersionSplitStepShould {

    private static final String CONTENT_1_0_0 = "{\"type\":\"req\"}";
    private static final String CONTENT_1_1_0 = "{\"type\":\"req-v1.1\"}";
    private static final String CONFIG_CONTENT = "{\"setting\":\"enabled\"}";

    private Nitrite db;
    private NitriteCollection controlHeaders;
    private NitriteCollection controlVersions;
    private NitriteCollection configHeaders;
    private NitriteCollection configVersions;
    private NitriteControlVersionSplitStep step;

    @BeforeEach
    void setup() {
        db = mock(Nitrite.class);
        controlHeaders = mock(NitriteCollection.class);
        controlVersions = mock(NitriteCollection.class);
        configHeaders = mock(NitriteCollection.class);
        configVersions = mock(NitriteCollection.class);
        when(db.getCollection("controls")).thenReturn(controlHeaders);
        when(db.getCollection("controlVersions")).thenReturn(controlVersions);
        when(db.getCollection("controlConfigurations")).thenReturn(configHeaders);
        when(db.getCollection("controlConfigurationVersions")).thenReturn(configVersions);

        step = new NitriteControlVersionSplitStep(db);
        stubCollectionContents(List.of());
    }

    /** Models the step's two-pass read, matching every other split step's Nitrite test. */
    private void stubCollectionContents(List<Document> documents) {
        DocumentCursor cursor = mock(DocumentCursor.class);
        when(controlHeaders.find()).thenReturn(cursor);
        when(cursor.iterator()).thenAnswer(invocation -> documents.iterator());
        when(controlHeaders.getById(any(NitriteId.class))).thenAnswer(invocation -> {
            NitriteId id = invocation.getArgument(0);
            return documents.stream()
                    .filter(document -> id.equals(document.getId()))
                    .findFirst()
                    .orElse(null);
        });
    }

    /** One old-shape domain document holding one control with two requirement versions and one configuration. */
    private static Document oldDomainDocument() {
        Document config = Document.createDocument()
                .put("configurationId", 10)
                .put("name", "cfg-name")
                .put("versions", Document.createDocument().put("1-0-0", CONFIG_CONTENT));
        Document control = Document.createDocument()
                .put("controlId", 1)
                .put("name", "Access Control")
                .put("description", "A description")
                .put("requirement", Document.createDocument()
                        .put("1-0-0", CONTENT_1_0_0)
                        .put("1-1-0", CONTENT_1_1_0))
                .put("configurations", List.of(config));
        return Document.createDocument()
                .put("domain", "security")
                .put("controls", List.of(control));
    }

    @Test
    void run_at_schema_version_thirteen() {
        assertThat(step.fromVersion(), is(13));
    }

    // --- fan-out: requirement level ---

    @Test
    void write_one_control_header_per_control_with_a_counted_version_total() {
        stubCollectionContents(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).insert(captor.capture());
        Document header = captor.getValue();
        assertThat(header.get("namespace", String.class), is("security"));
        assertThat(header.get("controlId", Integer.class), is(1));
        assertThat(header.get("name", String.class), is("Access Control"));
        assertThat(header.get("versionCount", Integer.class), is(2));
    }

    @Test
    void write_one_requirement_version_document_per_stored_version_with_dot_separated_keys() {
        stubCollectionContents(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions, times(2)).insert(captor.capture());
        assertThat(captor.getAllValues().stream().map(d -> d.get("version", String.class)).toList(),
                contains("1.0.0", "1.1.0"));
        assertThat(captor.getAllValues().get(0).get("content", String.class), is(CONTENT_1_0_0));
    }

    @Test
    void collapse_two_requirement_keys_that_mean_the_same_version_and_count_them_once() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("domain", "security")
                .put("controls", List.of(Document.createDocument()
                        .put("controlId", 1)
                        .put("requirement", Document.createDocument()
                                .put("1-0-0", CONTENT_1_0_0)
                                .put("100", CONTENT_1_1_0))
                        .put("configurations", List.of())))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", String.class), is(CONTENT_1_0_0));

        ArgumentCaptor<Document> headerCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).insert(headerCaptor.capture());
        assertThat(headerCaptor.getValue().get("versionCount", Integer.class), is(1));
    }

    @Test
    void migrate_requirement_content_that_is_not_a_string_rather_than_aborting_the_run() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("domain", "security")
                .put("controls", List.of(Document.createDocument()
                        .put("controlId", 1)
                        .put("requirement", Document.createDocument().put("1-0-0", 42))
                        .put("configurations", List.of())))));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(controlVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("content"), is(42));
    }

    @Test
    void write_a_control_header_but_no_requirement_versions_for_a_control_that_has_none() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("domain", "security")
                .put("controls", List.of(Document.createDocument().put("controlId", 9).put("name", "Empty")))));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(controlHeaders).insert(captor.capture());
        assertThat(captor.getValue().get("versionCount", Integer.class), is(0));
        verify(controlVersions, never()).insert(any(Document.class));
    }

    // --- fan-out: configuration level ---

    @Test
    void write_a_configuration_header_under_the_composite_domain_and_control_namespace() {
        stubCollectionContents(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(configHeaders).insert(captor.capture());
        Document header = captor.getValue();
        assertThat(header.get("namespace", String.class), is("security::1"));
        assertThat(header.get("configurationId", Integer.class), is(10));
        assertThat(header.get("name", String.class), is("cfg-name"));
        assertThat(header.get("versionCount", Integer.class), is(1));
    }

    @Test
    void write_one_configuration_version_document_under_the_composite_namespace() {
        stubCollectionContents(List.of(oldDomainDocument()));

        step.apply();

        ArgumentCaptor<Document> versionCaptor = ArgumentCaptor.forClass(Document.class);
        verify(configVersions).insert(versionCaptor.capture());
        assertThat(versionCaptor.getValue().get("namespace", String.class), is("security::1"));
        assertThat(versionCaptor.getValue().get("configurationId", Integer.class), is(10));
        assertThat(versionCaptor.getValue().get("version", String.class), is("1.0.0"));
        assertThat(versionCaptor.getValue().get("content", String.class), is(CONFIG_CONTENT));
    }

    @Test
    void write_no_configuration_documents_for_a_control_with_no_configurations() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("domain", "security")
                .put("controls", List.of(Document.createDocument()
                        .put("controlId", 1)
                        .put("requirement", Document.createDocument())
                        .put("configurations", List.of())))));

        step.apply();

        verify(configHeaders, never()).insert(any(Document.class));
        verify(configVersions, never()).insert(any(Document.class));
    }

    // --- ordering / idempotency ---

    @Test
    void remove_the_old_domain_document_by_identity_only_after_rewriting_both_levels() {
        Document oldDocument = oldDomainDocument();
        stubCollectionContents(List.of(oldDocument));

        step.apply();

        InOrder order = inOrder(controlHeaders, controlVersions, configHeaders, configVersions);
        order.verify(controlHeaders).insert(any(Document.class));
        order.verify(configHeaders).insert(any(Document.class));
        order.verify(configVersions).insert(any(Document.class));
        // By identity, not a domain filter: the headers just written share no key with the
        // old domain document.
        order.verify(controlHeaders).remove(oldDocument);
    }

    @Test
    void ignore_documents_that_are_already_headers() {
        stubCollectionContents(List.of(Document.createDocument()
                .put("namespace", "security").put("controlId", 1).put("versionCount", 2)));

        step.apply();

        verify(controlHeaders, never()).insert(any(Document.class));
        verify(controlHeaders, never()).remove(any(Document.class));
    }

    @Test
    void clear_any_partially_written_target_documents_before_inserting() {
        stubCollectionContents(List.of(oldDomainDocument()));

        step.apply();

        // Nitrite has no upsert, so a retried step would otherwise insert a second copy of a
        // header/version it already wrote — there is no unique index here to stop it.
        verify(controlHeaders).remove(any(Filter.class));
        verify(controlVersions, times(2)).remove(any(Filter.class));
        verify(configHeaders).remove(any(Filter.class));
        verify(configVersions).remove(any(Filter.class));
    }
}
