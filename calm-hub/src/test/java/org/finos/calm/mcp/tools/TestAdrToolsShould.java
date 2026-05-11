package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestAdrToolsShould {

    @Mock
    AdrStore adrStore;

    @InjectMocks
    AdrTools adrTools;

    @BeforeEach
    void setup() {
        adrTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    private static final String VALID_ADR_JSON = """
            {
              "title": "Use PostgreSQL",
              "contextAndProblemStatement": "We need a relational database",
              "decisionDrivers": [],
              "consideredOptions": [],
              "decisionOutcome": {"chosenOption": {"name": "PostgreSQL"}, "rationale": "Proven reliability"},
              "links": []
            }
            """;

    // --- listAdrs ---

    @Test
    void return_adrs_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(adrStore.getAdrsForNamespace("finos"))
                .thenReturn(List.of(
                        new NamespaceAdrSummary("Use PostgreSQL", "accepted", 1)
                ));

        ToolResponse result = adrTools.listAdrs("finos");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("finos"));
        assertThat(text(result), containsString("Use PostgreSQL"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_adrs_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(adrStore.getAdrsForNamespace("empty"))
                .thenReturn(List.of());

        ToolResponse result = adrTools.listAdrs("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No ADRs found"));
    }

    @Test
    void return_error_for_nonexistent_namespace_list_adrs() throws NamespaceNotFoundException {
        when(adrStore.getAdrsForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.listAdrs("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_adrs(String namespace) {
        ToolResponse result = adrTools.listAdrs(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_list_adrs() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.listAdrs("finos");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- getAdr ---

    @Test
    void return_adr_json_for_valid_id() throws Exception {
        AdrMeta meta = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(1).setRevision(1)
                .setAdr(null)
                .build();
        when(adrStore.getAdr(any(AdrMeta.class))).thenReturn(meta);

        ToolResponse result = adrTools.getAdr("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("namespace"));
    }

    @Test
    void return_error_when_adr_not_found_for_get() throws Exception {
        when(adrStore.getAdr(any(AdrMeta.class))).thenThrow(new AdrNotFoundException());

        ToolResponse result = adrTools.getAdr("finos", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_adr() throws Exception {
        when(adrStore.getAdr(any(AdrMeta.class))).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.getAdr("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_adr_revision_not_found_for_get() throws Exception {
        when(adrStore.getAdr(any(AdrMeta.class))).thenThrow(new AdrRevisionNotFoundException());

        ToolResponse result = adrTools.getAdr("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("revision"));
    }

    @Test
    void return_error_when_adr_parse_exception_for_get() throws Exception {
        when(adrStore.getAdr(any(AdrMeta.class))).thenThrow(new AdrParseException());

        ToolResponse result = adrTools.getAdr("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("parse"));
    }

    @Test
    void return_error_for_unexpected_exception_on_get_adr() throws Exception {
        when(adrStore.getAdr(any(AdrMeta.class))).thenThrow(new RuntimeException("unexpected"));

        ToolResponse result = adrTools.getAdr("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Unexpected"));
    }

    @Test
    void reject_non_positive_id_for_get_adr() {
        ToolResponse result = adrTools.getAdr("finos", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_get_adr() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.getAdr("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- listAdrRevisions ---

    @Test
    void return_revisions_for_valid_adr() throws Exception {
        when(adrStore.getAdrRevisions(any(AdrMeta.class))).thenReturn(List.of(1, 2, 3));

        ToolResponse result = adrTools.listAdrRevisions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("2"));
        assertThat(text(result), containsString("3"));
    }

    @Test
    void return_empty_revisions_message_for_adr() throws Exception {
        when(adrStore.getAdrRevisions(any(AdrMeta.class))).thenReturn(List.of());

        ToolResponse result = adrTools.listAdrRevisions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No revisions found"));
    }

    @Test
    void return_error_when_adr_not_found_for_list_revisions() throws Exception {
        when(adrStore.getAdrRevisions(any(AdrMeta.class))).thenThrow(new AdrNotFoundException());

        ToolResponse result = adrTools.listAdrRevisions("finos", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_list_revisions() throws Exception {
        when(adrStore.getAdrRevisions(any(AdrMeta.class))).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.listAdrRevisions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_adr_revision_not_found_for_list_revisions() throws Exception {
        when(adrStore.getAdrRevisions(any(AdrMeta.class))).thenThrow(new AdrRevisionNotFoundException());

        ToolResponse result = adrTools.listAdrRevisions("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("revision"));
    }

    @Test
    void reject_non_positive_id_for_list_adr_revisions() {
        ToolResponse result = adrTools.listAdrRevisions("finos", -1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_list_adr_revisions() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.listAdrRevisions("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- getAdrRevision ---

    @Test
    void return_specific_revision_content() throws Exception {
        AdrMeta meta = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(1).setRevision(2)
                .setAdr(null)
                .build();
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenReturn(meta);

        ToolResponse result = adrTools.getAdrRevision("finos", 1, 2);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("namespace"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_revision() throws Exception {
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.getAdrRevision("missing", 1, 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_adr_parse_exception_for_get_revision() throws Exception {
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(new AdrParseException());

        ToolResponse result = adrTools.getAdrRevision("finos", 1, 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("parse"));
    }

    @Test
    void return_error_for_unexpected_exception_on_get_revision() throws Exception {
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(new RuntimeException("unexpected"));

        ToolResponse result = adrTools.getAdrRevision("finos", 1, 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Unexpected"));
    }

    @Test
    void return_error_when_adr_revision_not_found_for_update() throws Exception {
        when(adrStore.updateAdrForNamespace(any(AdrMeta.class))).thenThrow(new AdrRevisionNotFoundException());

        ToolResponse result = adrTools.updateAdr("finos", 1, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("revision"));
    }

    @Test
    void return_error_when_adr_parse_exception_for_update() throws Exception {
        when(adrStore.updateAdrForNamespace(any(AdrMeta.class))).thenThrow(new AdrParseException());

        ToolResponse result = adrTools.updateAdr("finos", 1, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("parse"));
    }

    @Test
    void return_error_when_adr_revision_not_found_for_get_revision() throws Exception {
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(new AdrRevisionNotFoundException());

        ToolResponse result = adrTools.getAdrRevision("finos", 1, 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Revision"));
    }

    @Test
    void return_error_when_adr_not_found_for_get_revision() throws Exception {
        when(adrStore.getAdrRevision(any(AdrMeta.class))).thenThrow(new AdrNotFoundException());

        ToolResponse result = adrTools.getAdrRevision("finos", 99, 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_non_positive_revision_for_get_adr_revision() {
        ToolResponse result = adrTools.getAdrRevision("finos", 1, 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_get_adr_revision() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.getAdrRevision("finos", 1, 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- createAdr ---

    @Test
    void create_adr_successfully() throws Exception {
        AdrMeta created = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(7).setRevision(1)
                .setAdr(null)
                .build();
        when(adrStore.createAdrForNamespace(any(AdrMeta.class))).thenReturn(created);

        ToolResponse result = adrTools.createAdr("finos", VALID_ADR_JSON);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("7"));
        assertThat(text(result), containsString("revision 1"));
    }

    @Test
    void return_error_when_namespace_not_found_for_create_adr() throws Exception {
        when(adrStore.createAdrForNamespace(any(AdrMeta.class)))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.createAdr("missing", VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_adr_parse_exception_on_create() throws Exception {
        when(adrStore.createAdrForNamespace(any(AdrMeta.class)))
                .thenThrow(new AdrParseException());

        ToolResponse result = adrTools.createAdr("finos", VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("parse"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_adr_json_for_create(String json) {
        ToolResponse result = adrTools.createAdr("finos", json);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void reject_invalid_json_for_create_adr() {
        ToolResponse result = adrTools.createAdr("finos", "not-json-at-all");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_create_adr() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.createAdr("finos", VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- updateAdr ---

    @Test
    void update_adr_successfully() throws Exception {
        AdrMeta updated = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(1).setRevision(2)
                .setAdr(null)
                .build();
        when(adrStore.updateAdrForNamespace(any(AdrMeta.class))).thenReturn(updated);

        ToolResponse result = adrTools.updateAdr("finos", 1, VALID_ADR_JSON);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("revision 2"));
    }

    @Test
    void return_error_when_adr_not_found_for_update() throws Exception {
        when(adrStore.updateAdrForNamespace(any(AdrMeta.class))).thenThrow(new AdrNotFoundException());

        ToolResponse result = adrTools.updateAdr("finos", 99, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_update_adr() throws Exception {
        when(adrStore.updateAdrForNamespace(any(AdrMeta.class))).thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.updateAdr("missing", 1, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_non_positive_id_for_update_adr() {
        ToolResponse result = adrTools.updateAdr("finos", 0, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void reject_blank_json_for_update_adr() {
        ToolResponse result = adrTools.updateAdr("finos", 1, "");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_update_adr() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.updateAdr("finos", 1, VALID_ADR_JSON);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    // --- updateAdrStatus ---

    @Test
    void update_adr_status_successfully() throws Exception {
        AdrMeta updated = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(1).setRevision(1)
                .setAdr(null)
                .build();
        when(adrStore.updateAdrStatus(any(AdrMeta.class), eq(Status.accepted))).thenReturn(updated);

        ToolResponse result = adrTools.updateAdrStatus("finos", 1, "accepted");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("accepted"));
    }

    @Test
    void update_adr_status_case_insensitive() throws Exception {
        AdrMeta updated = new AdrMeta.AdrMetaBuilder()
                .setNamespace("finos").setId(1).setRevision(1)
                .setAdr(null)
                .build();
        when(adrStore.updateAdrStatus(any(AdrMeta.class), eq(Status.proposed))).thenReturn(updated);

        ToolResponse result = adrTools.updateAdrStatus("finos", 1, "PROPOSED");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("proposed"));
    }

    @Test
    void return_error_for_invalid_status_value() {
        ToolResponse result = adrTools.updateAdrStatus("finos", 1, "invalid-status");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid status"));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_adr_not_found_for_status_update() throws Exception {
        when(adrStore.updateAdrStatus(any(AdrMeta.class), any(Status.class)))
                .thenThrow(new AdrNotFoundException());

        ToolResponse result = adrTools.updateAdrStatus("finos", 99, "accepted");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_persistence_fails_for_status_update() throws Exception {
        when(adrStore.updateAdrStatus(any(AdrMeta.class), any(Status.class)))
                .thenThrow(new AdrPersistenceException());

        ToolResponse result = adrTools.updateAdrStatus("finos", 1, "accepted");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("persist"));
    }

    @Test
    void return_error_when_namespace_not_found_for_status_update() throws Exception {
        when(adrStore.updateAdrStatus(any(AdrMeta.class), any(Status.class)))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = adrTools.updateAdrStatus("missing", 1, "accepted");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_status_for_update_adr_status(String status) {
        ToolResponse result = adrTools.updateAdrStatus("finos", 1, status);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void reject_non_positive_id_for_update_adr_status() {
        ToolResponse result = adrTools.updateAdrStatus("finos", 0, "accepted");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(adrStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_update_adr_status() {
        adrTools.mcpEnabled = false;

        ToolResponse result = adrTools.updateAdrStatus("finos", 1, "accepted");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(adrStore);
    }

    @Test
    void reject_oversized_json_for_create_adr() {
        String hugeJson = "{\"title\":\"" + "a".repeat(100_001) + "\"}";
        ToolResponse result = adrTools.createAdr("finos", hugeJson);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("ADR JSON"));
        verifyNoInteractions(adrStore);
    }

    @Test
    void reject_oversized_json_for_update_adr() {
        String hugeJson = "{\"title\":\"" + "a".repeat(100_001) + "\"}";
        ToolResponse result = adrTools.updateAdr("finos", 1, hugeJson);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("ADR JSON"));
        verifyNoInteractions(adrStore);
    }
}
