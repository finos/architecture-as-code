package org.finos.calm.store.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Link;
import org.finos.calm.domain.adr.Option;
import org.finos.calm.domain.adr.Status;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestAdrDocumentMapperShould {

    private static final String FULL_DOCUMENT = """
            {
              "$id": "ignored",
              "unique-id": "ignored-too",
              "slug": "use-oauth2",
              "title": "Use OAuth2",
              "status": "accepted",
              "decision-date": "2024-05-01",
              "requesters": ["alice"],
              "approvers": ["bob"],
              "context-and-problem-statement": "We need auth",
              "decision-drivers": ["security"],
              "considered-options": [
                {"name": "OAuth2", "description": "Standard", "positive-consequences": ["common"], "negative-consequences": ["complex"]},
                {"name": "Basic", "description": "Simple"}
              ],
              "decision-outcome": {"chosen-option": "OAuth2", "rationale": "Widely used"},
              "links": [{"rel": "justifies", "href": "/calm/namespaces/finos/architectures/a"}]
            }
            """;

    private final AdrDocumentMapper mapper = new AdrDocumentMapper();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void read_every_field_of_a_kebab_case_document() throws Exception {
        AdrDocumentMapper.ParsedAdrDocument parsed = mapper.fromDocument(FULL_DOCUMENT);
        Adr adr = new Adr.AdrBuilder(parsed.request()).setStatus(parsed.status()).build();

        assertThat(parsed.slug(), is("use-oauth2"));
        assertThat(parsed.status(), is(Status.accepted));
        assertThat(adr.getTitle(), is("Use OAuth2"));
        assertThat(adr.getDecisionDate(), is(LocalDate.of(2024, 5, 1)));
        assertThat(adr.getRequesters(), is(List.of("alice")));
        assertThat(adr.getApprovers(), is(List.of("bob")));
        assertThat(adr.getContextAndProblemStatement(), is("We need auth"));
        assertThat(adr.getDecisionDrivers(), is(List.of("security")));
        assertThat(adr.getConsideredOptions().get(0),
                is(new Option("OAuth2", "Standard", List.of("common"), List.of("complex"))));
        // The name resolves to the whole considered option, not a stub.
        assertThat(adr.getDecisionOutcome().getChosenOption(), is(adr.getConsideredOptions().get(0)));
        assertThat(adr.getDecisionOutcome().getRationale(), is("Widely used"));
        assertThat(adr.getLinks(), is(List.of(new Link("justifies", "/calm/namespaces/finos/architectures/a"))));
    }

    @Test
    void round_trip_a_document_through_the_hub_model() throws Exception {
        AdrDocumentMapper.ParsedAdrDocument parsed = mapper.fromDocument(FULL_DOCUMENT);
        Adr adr = new Adr.AdrBuilder(parsed.request()).setStatus(parsed.status())
                .setCreationDateTime(LocalDateTime.now()).build();

        JsonNode written = objectMapper.readTree(mapper.toDocument(adr, "http://hub/x", "use-oauth2"));
        JsonNode original = objectMapper.readTree(FULL_DOCUMENT);
        ((com.fasterxml.jackson.databind.node.ObjectNode) original).remove("unique-id");
        ((com.fasterxml.jackson.databind.node.ObjectNode) original).put("$id", "http://hub/x");

        assertThat(written, is(original));
        assertThat(written.has("creationDateTime"), is(false));
    }

    @Test
    void sanitise_strings_read_from_a_document() throws Exception {
        String document = """
                {"title": "Use <b>Kafka</b><script>x</script>", "status": "draft",
                 "context-and-problem-statement": "ctx<img>",
                 "considered-options": [{"name": "A<script></script>", "description": "d"}],
                 "decision-outcome": {"chosen-option": "A<script></script>", "rationale": "r"},
                 "requesters": ["alice<img>"]}
                """;

        Adr adr = new Adr.AdrBuilder(mapper.fromDocument(document).request()).build();

        assertThat(adr.getTitle(), is("Use <b>Kafka</b>"));
        assertThat(adr.getContextAndProblemStatement(), is("ctx"));
        assertThat(adr.getRequesters(), is(List.of("alice")));
        assertThat(adr.getDecisionOutcome().getChosenOption().getName(), is("A"));
    }

    @Test
    void leave_out_absent_fields_when_writing() {
        Adr adr = new Adr.AdrBuilder().setTitle("Only a title")
                .setDecisionOutcome(new Decision(null, null)).build();

        assertThat(mapper.toDocument(adr, null, null), is("{\"title\":\"Only a title\",\"decision-outcome\":{}}"));
    }

    @Test
    void accept_a_document_with_no_status_or_optional_fields() throws Exception {
        AdrDocumentMapper.ParsedAdrDocument parsed = mapper.fromDocument(
                "{\"title\": \"T\", \"context-and-problem-statement\": \"C\", \"decision-outcome\": {\"rationale\": \"r\"}}");

        assertThat(parsed.status(), is(nullValue()));
        assertThat(parsed.slug(), is(nullValue()));
        assertThat(parsed.request().getDecisionOutcome().getChosenOption(), is(nullValue()));
    }

    static Stream<Arguments> invalidDocuments() {
        return Stream.of(
                Arguments.of("not json", "Cannot parse"),
                Arguments.of("[]", "must be a JSON object"),
                Arguments.of("{\"context-and-problem-statement\": \"C\"}", "title is required"),
                Arguments.of("{\"title\": \" \", \"context-and-problem-statement\": \"C\"}", "title is required"),
                Arguments.of("{\"title\": \"T\"}", "context-and-problem-statement is required"),
                Arguments.of("{\"title\": 4, \"context-and-problem-statement\": \"C\"}", "title must be a string"),
                Arguments.of("{\"slug\": \"1-bad\", \"title\": \"T\", \"context-and-problem-statement\": \"C\"}", "slug must match"),
                Arguments.of("{\"title\": \"T\", \"status\": \"done\", \"context-and-problem-statement\": \"C\"}", "Invalid status: done"),
                Arguments.of("{\"title\": \"T\", \"decision-date\": \"May 1\", \"context-and-problem-statement\": \"C\"}", "decision-date"),
                Arguments.of("{\"title\": \"T\", \"requesters\": [1], \"context-and-problem-statement\": \"C\"}", "requesters must be an array of strings"),
                Arguments.of("{\"title\": \"T\", \"links\": \"x\", \"context-and-problem-statement\": \"C\"}", "links must be an array of objects"),
                Arguments.of("{\"title\": \"T\", \"considered-options\": [{}], \"context-and-problem-statement\": \"C\"}", "require a name"),
                Arguments.of("{\"title\": \"T\", \"decision-outcome\": \"x\", \"context-and-problem-statement\": \"C\"}", "decision-outcome must be an object"),
                Arguments.of("{\"title\": \"T\", \"context-and-problem-statement\": \"C\", \"considered-options\": [{\"name\": \"A\"}], \"decision-outcome\": {\"chosen-option\": \"B\"}}",
                        "chosen-option B does not match"),
                Arguments.of("{\"title\": \"T\", \"context-and-problem-statement\": \"C\", \"decision-outcome\": {\"chosen-option\": \"B\"}}",
                        "chosen-option B does not match")
        );
    }

    @ParameterizedTest
    @MethodSource("invalidDocuments")
    void reject_an_invalid_document_with_a_message_naming_the_problem(String document, String message) {
        AdrDocumentMapper.InvalidAdrDocumentException e = assertThrows(
                AdrDocumentMapper.InvalidAdrDocumentException.class, () -> mapper.fromDocument(document));

        assertThat(e.getMessage(), containsString(message));
    }

    @Test
    void read_a_camel_case_hub_adr_file() throws Exception {
        String camel = """
                {"title": "Use Kafka", "status": "proposed", "contextAndProblemStatement": "ctx",
                 "creationDateTime": [2024, 1, 2, 3, 4, 5], "unknownField": true}
                """;

        Adr adr = mapper.fromAnyShape(camel);

        assertThat(adr.getTitle(), is("Use Kafka"));
        assertThat(adr.getStatus(), is(Status.proposed));
        assertThat(adr.getContextAndProblemStatement(), is("ctx"));
    }

    @Test
    void reject_a_camel_case_file_with_fields_of_the_wrong_shape() {
        assertThrows(AdrDocumentMapper.InvalidAdrDocumentException.class,
                () -> mapper.fromAnyShape("{\"title\": \"T\", \"consideredOptions\": \"oops\"}"));
    }

    @Test
    void read_a_kebab_case_file_leniently() throws Exception {
        String lenient = """
                {"title": 7, "status": "bogus", "decision-date": "soon", "requesters": "alice",
                 "considered-options": "x", "links": [{"rel": 1, "href": "h"}],
                 "decision-outcome": {"chosen-option": "Missing", "rationale": "r"}}
                """;

        Adr adr = mapper.fromAnyShape(lenient);

        assertThat(adr.getTitle(), is(nullValue()));
        assertThat(adr.getStatus(), is(nullValue()));
        assertThat(adr.getDecisionDate(), is(nullValue()));
        assertThat(adr.getRequesters(), is(nullValue()));
        assertThat(adr.getConsideredOptions(), is(nullValue()));
        assertThat(adr.getLinks().get(0).getRel(), is(nullValue()));
        // An unresolved option keeps its name, so a reader still sees what was chosen.
        assertThat(adr.getDecisionOutcome().getChosenOption().getName(), is("Missing"));
        assertThat(adr.getDecisionOutcome().getChosenOption().getDescription(), is(nullValue()));
    }

    @Test
    void read_a_kebab_case_file_with_a_non_object_outcome_and_unnamed_option() throws Exception {
        Adr adr = mapper.fromAnyShape("{\"decision-outcome\": 3, \"considered-options\": [{\"description\": \"d\"}]}");

        assertThat(adr.getDecisionOutcome(), is(nullValue()));
        assertThat(adr.getConsideredOptions().get(0).getName(), is(nullValue()));
    }

    @Test
    void reject_a_file_that_is_not_a_json_object() {
        assertThrows(AdrDocumentMapper.InvalidAdrDocumentException.class, () -> mapper.fromAnyShape("[1]"));
        assertThrows(AdrDocumentMapper.InvalidAdrDocumentException.class, () -> mapper.fromAnyShape(null));
    }

    @Test
    void read_the_slug_a_file_declares() {
        assertThat(mapper.declaredSlug("{\"slug\": \"my-adr\"}"), is("my-adr"));
        assertThat(mapper.declaredSlug("{\"slug\": 4}"), is(nullValue()));
        assertThat(mapper.declaredSlug("not json"), is(nullValue()));
    }
}
