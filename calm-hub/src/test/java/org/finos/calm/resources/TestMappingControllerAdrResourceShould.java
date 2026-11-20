package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Option;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.AdrSlugExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.ADR_REVISION_OR_SHA_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.CUSTOM_ID_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The name-based ADR routes of {@link MappingControllerResource}: slug addressing, integer
 * revisions, and the kebab-case {@code adr.json} document shape.
 */
@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestMappingControllerAdrResourceShould {

    private static final String NAMESPACE = "finos";
    private static final String SLUG = "use-oauth2";
    private static final int ADR_ID = 42;
    private static final String BASE = "/calm/namespaces/finos/adrs";

    private static final String DOCUMENT = """
            {
              "$id": "ignored",
              "unique-id": "ignored",
              "title": "Use OAuth2",
              "status": "proposed",
              "decision-date": "2024-05-01",
              "context-and-problem-statement": "We need auth",
              "considered-options": [{"name": "OAuth2", "description": "Standard"}],
              "decision-outcome": {"chosen-option": "OAuth2", "rationale": "Widely used"}
            }
            """;

    @InjectMock AdrStore mockAdrStore;
    @InjectMock ResourceMappingStore mockMappingStore;
    @InjectMock CalmHubPermissionChecker mockPermissionChecker;
    @InjectMock AuditService mockAuditService;

    @BeforeEach
    void allowWrites() {
        when(mockPermissionChecker.canWrite(any(), any())).thenReturn(true);
    }

    private static Adr storedAdr(Status status) {
        Option option = new Option("OAuth2", "Standard", null, null);
        return new Adr.AdrBuilder()
                .setTitle("Use OAuth2")
                .setStatus(status)
                .setDecisionDate(LocalDate.of(2024, 5, 1))
                .setContextAndProblemStatement("We need auth")
                .setConsideredOptions(List.of(option))
                .setDecisionOutcome(new Decision(option, "Widely used"))
                .build();
    }

    private static AdrMeta storedMeta(int revision, Status status) {
        return new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(ADR_ID).setSlug(SLUG)
                .setRevision(revision).setAdr(storedAdr(status)).build();
    }

    private AuditLogEntry lastAuditEntry() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService, atLeastOnce()).record(captor.capture());
        return captor.getAllValues().get(captor.getAllValues().size() - 1);
    }

    // --- GET list ---

    @Test
    void list_adrs_by_slug_from_the_adr_store() throws Exception {
        when(mockAdrStore.getAdrSlugs(NAMESPACE)).thenReturn(
                List.of(new AdrSlugMapping("use-oauth2", 1), new AdrSlugMapping("use-kafka", 2)));

        given().when().get(BASE)
                .then().statusCode(200)
                .body("values[0].namespace", equalTo(NAMESPACE))
                .body("values[0].customId", equalTo("use-oauth2"))
                .body("values[0].resourceType", equalTo("ADR"))
                .body("values[0].numericId", equalTo(1))
                .body("values[1].customId", equalTo("use-kafka"));

        verifyNoInteractions(mockMappingStore);
    }

    @Test
    void return_404_when_listing_adrs_in_an_unknown_namespace() throws Exception {
        when(mockAdrStore.getAdrSlugs(NAMESPACE)).thenThrow(new NamespaceNotFoundException());

        given().when().get(BASE).then().statusCode(404);
    }

    @Test
    void return_400_for_an_invalid_namespace_on_list() {
        given().when().get("/calm/namespaces/fin_os/adrs")
                .then().statusCode(400).body(containsString(NAMESPACE_MESSAGE));
    }

    // --- GET latest ---

    @Test
    void return_the_latest_revision_as_an_adr_document() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        AdrMeta latest = storedMeta(3, Status.accepted);
        when(mockAdrStore.getAdr(any(AdrMeta.class))).thenReturn(latest);
        when(mockAdrStore.getVersionLabel(latest)).thenReturn("3");

        given().when().get(BASE + "/" + SLUG)
                .then().statusCode(200)
                .body("$id", equalTo("http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/3"))
                .body("slug", equalTo(SLUG))
                .body("title", equalTo("Use OAuth2"))
                .body("status", equalTo("accepted"))
                .body("decision-date", equalTo("2024-05-01"))
                .body("context-and-problem-statement", equalTo("We need auth"))
                .body("decision-outcome.chosen-option", equalTo("OAuth2"))
                .body("$", not(hasKey("creationDateTime")))
                .body("$", not(hasKey("requesters")));
    }

    static Stream<Arguments> latestFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new AdrNotFoundException(), 404),
                Arguments.of(new AdrRevisionNotFoundException(), 404),
                Arguments.of(new AdrParseException(), 500)
        );
    }

    @ParameterizedTest
    @MethodSource("latestFailures")
    void respond_correctly_when_the_latest_revision_cannot_be_read(Exception failure, int status) throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdr(any(AdrMeta.class))).thenThrow(failure);

        given().when().get(BASE + "/" + SLUG).then().statusCode(status);
    }

    @Test
    void return_400_for_an_invalid_slug() {
        given().when().get(BASE + "/1-bad").then().statusCode(400).body(containsString(CUSTOM_ID_MESSAGE));
    }

    // --- GET versions ---

    @Test
    void list_revisions_in_numeric_order() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrVersions(NAMESPACE, ADR_ID)).thenReturn(List.of("10", "2", "1"));

        given().when().get(BASE + "/" + SLUG + "/versions")
                .then().statusCode(200).body("values", equalTo(List.of("1", "2", "10")));
    }

    @Test
    void keep_the_order_of_versions_that_are_not_numbers() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrVersions(NAMESPACE, ADR_ID)).thenReturn(List.of("bbbbbbb", "aaaaaaa"));

        given().when().get(BASE + "/" + SLUG + "/versions")
                .then().statusCode(200).body("values", equalTo(List.of("bbbbbbb", "aaaaaaa")));
    }

    static Stream<Arguments> versionsFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new AdrNotFoundException(), 404),
                Arguments.of(new AdrRevisionNotFoundException(), 404)
        );
    }

    @ParameterizedTest
    @MethodSource("versionsFailures")
    void respond_correctly_when_versions_cannot_be_listed(Exception failure, int status) throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrVersions(NAMESPACE, ADR_ID)).thenThrow(failure);

        given().when().get(BASE + "/" + SLUG + "/versions").then().statusCode(status);
    }

    // --- GET version ---

    @Test
    void return_a_revision_with_its_canonical_id() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrForVersion(NAMESPACE, ADR_ID, "2")).thenReturn(storedMeta(2, Status.draft));

        given().when().get(BASE + "/" + SLUG + "/versions/2")
                .then().statusCode(200)
                .body("$id", equalTo("http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/2"))
                .body("status", equalTo("draft"));
    }

    @Test
    void accept_a_commit_sha_as_a_version() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrForVersion(NAMESPACE, ADR_ID, "abc1234")).thenReturn(storedMeta(0, Status.draft));

        given().when().get(BASE + "/" + SLUG + "/versions/abc1234")
                .then().statusCode(200)
                .body("$id", equalTo("http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/abc1234"));
    }

    @Test
    void return_400_for_a_semantic_version() {
        given().when().get(BASE + "/" + SLUG + "/versions/1.0.0")
                .then().statusCode(400).body(containsString(ADR_REVISION_OR_SHA_MESSAGE));
    }

    static Stream<Arguments> versionFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404, "Invalid namespace"),
                Arguments.of(new AdrNotFoundException(), 404, "ADR not found"),
                Arguments.of(new AdrRevisionNotFoundException(), 404, "Revision not found: 9"),
                Arguments.of(new AdrParseException(), 500, "Could not parse")
        );
    }

    @ParameterizedTest
    @MethodSource("versionFailures")
    void respond_correctly_when_a_revision_cannot_be_read(Exception failure, int status, String message) throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.getAdrForVersion(NAMESPACE, ADR_ID, "9")).thenThrow(failure);

        given().when().get(BASE + "/" + SLUG + "/versions/9")
                .then().statusCode(status).body(containsString(message));
    }

    // --- POST create ---

    @Test
    void create_an_adr_and_return_the_document_at_revision_one() throws Exception {
        when(mockAdrStore.createAdrForNamespace(any(AdrMeta.class))).thenAnswer(invocation -> {
            AdrMeta request = invocation.getArgument(0);
            return new AdrMeta.AdrMetaBuilder(request).setId(ADR_ID).setSlug(SLUG).build();
        });

        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE)
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/adrs/use-oauth2/versions/1"))
                .body("$id", equalTo("http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/1"))
                .body("status", equalTo("proposed"))
                .body("decision-outcome.chosen-option", equalTo("OAuth2"));

        ArgumentCaptor<AdrMeta> captor = ArgumentCaptor.forClass(AdrMeta.class);
        verify(mockAdrStore).createAdrForNamespace(captor.capture());
        AdrMeta request = captor.getValue();
        assertThat(request.getNamespace(), is(NAMESPACE));
        assertThat(request.getRevision(), is(1));
        assertThat(request.getSlug(), is((String) null));
        assertThat(request.getAdr().getStatus(), is(Status.proposed));
        assertThat(request.getAdr().getDecisionOutcome().getChosenOption().getDescription(), is("Standard"));
        assertThat(request.getAdr().getCreationDateTime() != null, is(true));

        AuditLogEntry audit = lastAuditEntry();
        assertThat(audit.getEntityType(), is(AuditEntityType.ADR));
        assertThat(audit.getAction(), is(AuditAction.CREATE));
        assertThat(audit.getEntityId(), is(SLUG));
        assertThat(audit.getVersion(), is("1"));
    }

    @Test
    void create_a_draft_with_the_requested_slug_when_the_document_says_so() throws Exception {
        when(mockAdrStore.createAdrForNamespace(any(AdrMeta.class))).thenAnswer(invocation ->
                new AdrMeta.AdrMetaBuilder(invocation.getArgument(0)).setId(ADR_ID).build());
        String document = "{\"slug\": \"my-choice\", \"title\": \"T\", \"context-and-problem-statement\": \"C\"}";

        given().header("Content-Type", "application/json").body(document)
                .when().post(BASE)
                .then().statusCode(201)
                .header("Location", containsString("/adrs/my-choice/versions/1"))
                .body("status", equalTo("draft"));

        ArgumentCaptor<AdrMeta> captor = ArgumentCaptor.forClass(AdrMeta.class);
        verify(mockAdrStore).createAdrForNamespace(captor.capture());
        assertThat(captor.getValue().getSlug(), is("my-choice"));
    }

    static Stream<Arguments> invalidDocuments() {
        return Stream.of(
                Arguments.of("not json", "Cannot parse"),
                Arguments.of("{\"context-and-problem-statement\": \"C\", \"status\": \"draft\"}", "title is required"),
                Arguments.of("{\"title\": \"T\", \"status\": \"draft\"}", "context-and-problem-statement is required"),
                Arguments.of("{\"title\": \"T\", \"status\": \"finished\", \"context-and-problem-statement\": \"C\"}",
                        "Invalid status: finished"),
                Arguments.of("{\"title\": \"T\", \"context-and-problem-statement\": \"C\", "
                        + "\"considered-options\": [{\"name\": \"A\", \"description\": \"a\"}], "
                        + "\"decision-outcome\": {\"chosen-option\": \"Nope\", \"rationale\": \"r\"}}",
                        "chosen-option Nope does not match")
        );
    }

    @ParameterizedTest
    @MethodSource("invalidDocuments")
    void return_400_for_an_invalid_document_on_create(String document, String message) {
        given().header("Content-Type", "application/json").body(document)
                .when().post(BASE)
                .then().statusCode(400).body(containsString(message));

        verifyNoInteractions(mockAdrStore);
    }

    static Stream<Arguments> createFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new AdrSlugExistsException(), 409),
                Arguments.of(new AdrParseException(), 500)
        );
    }

    @ParameterizedTest
    @MethodSource("createFailures")
    void respond_correctly_when_the_store_refuses_a_create(Exception failure, int status) throws Exception {
        when(mockAdrStore.createAdrForNamespace(any(AdrMeta.class))).thenThrow(failure);

        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE)
                .then().statusCode(status);
    }

    // --- POST revision ---

    @Test
    void add_a_revision_with_the_documents_status() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.createAdrRevision(any(AdrMeta.class))).thenAnswer(invocation ->
                new AdrMeta.AdrMetaBuilder(invocation.getArgument(0)).setRevision(3).build());

        given().header("Content-Type", "application/json").body(DOCUMENT.replace("\"$id\": \"ignored\",", "\"slug\": \"use-oauth2\","))
                .when().post(BASE + "/" + SLUG)
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/adrs/use-oauth2/versions/3"))
                .body("$id", equalTo("http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/3"))
                .body("slug", equalTo(SLUG));

        ArgumentCaptor<AdrMeta> captor = ArgumentCaptor.forClass(AdrMeta.class);
        verify(mockAdrStore).createAdrRevision(captor.capture());
        assertThat(captor.getValue().getId(), is(ADR_ID));
        assertThat(captor.getValue().getAdr().getStatus(), is(Status.proposed));

        AuditLogEntry audit = lastAuditEntry();
        assertThat(audit.getAction(), is(AuditAction.UPDATE));
        assertThat(audit.getEntityId(), is(SLUG));
        assertThat(audit.getVersion(), is("3"));
    }

    @Test
    void return_400_when_the_body_slug_differs_from_the_path() {
        given().header("Content-Type", "application/json")
                .body("{\"slug\": \"other\", \"title\": \"T\", \"status\": \"draft\", \"context-and-problem-statement\": \"C\"}")
                .when().post(BASE + "/" + SLUG)
                .then().statusCode(400).body(containsString("does not match the slug in the path"));
    }

    @Test
    void return_400_when_a_revision_has_no_status() {
        given().header("Content-Type", "application/json")
                .body("{\"title\": \"T\", \"context-and-problem-statement\": \"C\"}")
                .when().post(BASE + "/" + SLUG)
                .then().statusCode(400).body(containsString("status is required"));
    }

    @Test
    void return_400_for_an_invalid_document_on_revision() {
        given().header("Content-Type", "application/json").body("[]")
                .when().post(BASE + "/" + SLUG)
                .then().statusCode(400).body(containsString("must be a JSON object"));
    }

    static Stream<Arguments> revisionFailures() {
        return Stream.of(
                Arguments.of(new NamespaceNotFoundException(), 404),
                Arguments.of(new AdrNotFoundException(), 404),
                Arguments.of(new AdrRevisionNotFoundException(), 404),
                Arguments.of(new AdrRevisionExistsException(), 409),
                Arguments.of(new AdrParseException(), 500)
        );
    }

    @ParameterizedTest
    @MethodSource("revisionFailures")
    void respond_correctly_when_the_store_refuses_a_revision(Exception failure, int status) throws Exception {
        when(mockAdrStore.getAdrIdBySlug(NAMESPACE, SLUG)).thenReturn(ADR_ID);
        when(mockAdrStore.createAdrRevision(any(AdrMeta.class))).thenThrow(failure);

        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE + "/" + SLUG)
                .then().statusCode(status);
    }

    @Test
    void return_404_when_adding_a_revision_to_an_unknown_slug() throws Exception {
        when(mockAdrStore.getAdrIdBySlug(eq(NAMESPACE), anyString())).thenThrow(new AdrNotFoundException());

        given().header("Content-Type", "application/json").body(DOCUMENT)
                .when().post(BASE + "/missing")
                .then().statusCode(404).body(containsString("ADR not found: missing"));
    }

    // --- writes the ADR routes do not take ---

    @Test
    void return_400_when_posting_an_adr_to_the_semver_route() {
        given().header("Content-Type", "application/json")
                .body("{\"$id\": \"http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/1.0.0\", \"title\": \"T\"}")
                .when().post(BASE + "/" + SLUG + "/versions/1.0.0")
                .then().statusCode(400).body(containsString("POST /calm/namespaces/{namespace}/adrs"));

        verifyNoInteractions(mockAdrStore);
    }

    @Test
    void return_400_when_posting_an_adr_by_id() {
        given().header("Content-Type", "application/json")
                .body("{\"$id\": \"http://localhost:8080/calm/namespaces/finos/adrs/use-oauth2/versions/3\", \"title\": \"T\"}")
                .when().post("/calm")
                .then().statusCode(400).body(containsString("POST /calm/namespaces/{namespace}/adrs"));

        verifyNoInteractions(mockAdrStore);
    }
}
