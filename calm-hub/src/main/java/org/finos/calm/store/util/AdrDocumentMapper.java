package org.finos.calm.store.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrSlugs;
import org.finos.calm.domain.adr.Decision;
import org.finos.calm.domain.adr.Link;
import org.finos.calm.domain.adr.NewAdrRequest;
import org.finos.calm.domain.adr.Option;
import org.finos.calm.domain.adr.Status;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.finos.calm.resources.ResourceValidationConstants.CUSTOM_ID_REGEX;

/**
 * Converts between the Hub's camelCase {@link Adr} and the kebab-case {@code adr.json}
 * document that the name-based {@code /calm/namespaces/{ns}/adrs} endpoints and ADR files
 * use.
 *
 * <p>The two shapes are not a mechanical rename. {@code decision-outcome.chosen-option} is
 * the <em>name</em> of an option, where the Hub stores the whole {@link Option}. Hub to file
 * emits the name. File to Hub looks the option up in {@code considered-options}; a strict
 * read rejects a name that matches none, because a stub {@link Option} would be content the
 * author did not write. Server timestamps never appear in the document.</p>
 */
public class AdrDocumentMapper {

    /** A document the strict reader refuses. The message is safe to return to the caller once sanitised. */
    public static class InvalidAdrDocumentException extends Exception {
        public InvalidAdrDocumentException(String message) {
            super(message);
        }
    }

    /**
     * A parsed request document.
     *
     * @param slug    the requested slug, or {@code null} if the document has none
     * @param status  the document's status, or {@code null} if it has none
     * @param request the content, sanitised by {@link NewAdrRequest}'s setters
     */
    public record ParsedAdrDocument(String slug, Status status, NewAdrRequest request) {
    }

    private static final Set<String> CAMEL_CASE_MARKERS = Set.of(
            "contextAndProblemStatement", "decisionDrivers", "consideredOptions", "decisionOutcome", "decisionDate");
    private static final String SUPPORTED_STATUSES = Arrays.stream(Status.values())
            .map(Status::name).collect(Collectors.joining(", "));
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /**
     * Reads a kebab-case document from a request. {@code $id} and {@code unique-id} are
     * ignored; the Hub owns both.
     *
     * @throws InvalidAdrDocumentException if the JSON is malformed, a required field is
     *                                     missing, a field has the wrong type, or
     *                                     {@code chosen-option} names no considered option
     */
    public ParsedAdrDocument fromDocument(String json) throws InvalidAdrDocumentException {
        JsonNode root = readObject(json);
        String slug = text(root, "slug", true);
        if (slug != null && !AdrSlugs.isValid(slug)) {
            throw new InvalidAdrDocumentException("slug must match pattern " + CUSTOM_ID_REGEX);
        }
        String title = text(root, "title", true);
        if (title == null || title.isBlank()) {
            throw new InvalidAdrDocumentException("title is required");
        }
        String context = text(root, "context-and-problem-statement", true);
        if (context == null || context.isBlank()) {
            throw new InvalidAdrDocumentException("context-and-problem-statement is required");
        }
        ParsedAdrDocument parsed = new ParsedAdrDocument(slug, status(root, true), request(root, true));
        if (parsed.request().getTitle() == null || parsed.request().getTitle().isBlank()) {
            throw new InvalidAdrDocumentException("title is required (sanitized to blank)");
        }
        if (parsed.request().getContextAndProblemStatement() == null || parsed.request().getContextAndProblemStatement().isBlank()) {
            throw new InvalidAdrDocumentException("context-and-problem-statement is required (sanitized to blank)");
        }
        return parsed;
    }

    /**
     * Reads an ADR file in either shape: kebab-case {@code adr.json}, or the Hub's own
     * camelCase form. Lenient, because a file in a repository is content to show, not a
     * request to refuse: a wrongly typed field is dropped, and a {@code chosen-option} that
     * names no considered option keeps its name with no other detail.
     *
     * @throws InvalidAdrDocumentException only if the content is not a JSON object
     */
    public Adr fromAnyShape(String json) throws InvalidAdrDocumentException {
        JsonNode root = readObject(json);
        if (CAMEL_CASE_MARKERS.stream().anyMatch(root::has)) {
            try {
                return objectMapper.treeToValue(root, Adr.class);
            } catch (JsonProcessingException | IllegalArgumentException e) {
                throw new InvalidAdrDocumentException("ADR content is not a valid ADR");
            }
        }
        try {
            NewAdrRequest request = request(root, false);
            return new Adr.AdrBuilder(request).setStatus(status(root, false)).build();
        } catch (InvalidAdrDocumentException e) {
            throw new IllegalStateException("A lenient read never rejects a document", e);
        }
    }

    /** @return the slug a file declares, or {@code null} if it declares none. */
    public String declaredSlug(String json) {
        try {
            return text(readObject(json), "slug", false);
        } catch (InvalidAdrDocumentException e) {
            return null;
        }
    }

    /**
     * Writes {@code adr} as a kebab-case document. Null fields are left out.
     *
     * @param id   the canonical URL to emit as {@code $id}, or {@code null} for none
     * @param slug the slug to emit, or {@code null} for none
     */
    public String toDocument(Adr adr, String id, String slug) {
        ObjectNode document = objectMapper.createObjectNode();
        putText(document, "$id", id);
        putText(document, "slug", slug);
        putText(document, "title", adr.getTitle());
        putText(document, "status", adr.getStatus() == null ? null : adr.getStatus().name());
        putText(document, "decision-date", adr.getDecisionDate() == null ? null : adr.getDecisionDate().toString());
        putTexts(document, "requesters", adr.getRequesters());
        putTexts(document, "approvers", adr.getApprovers());
        putText(document, "context-and-problem-statement", adr.getContextAndProblemStatement());
        putTexts(document, "decision-drivers", adr.getDecisionDrivers());
        if (adr.getConsideredOptions() != null) {
            ArrayNode options = document.putArray("considered-options");
            for (Option option : adr.getConsideredOptions()) {
                options.add(optionNode(option));
            }
        }
        Decision decision = adr.getDecisionOutcome();
        if (decision != null) {
            ObjectNode outcome = document.putObject("decision-outcome");
            putText(outcome, "chosen-option",
                    decision.getChosenOption() == null ? null : decision.getChosenOption().getName());
            putText(outcome, "rationale", decision.getRationale());
        }
        if (adr.getLinks() != null) {
            ArrayNode links = document.putArray("links");
            for (Link link : adr.getLinks()) {
                ObjectNode linkNode = links.addObject();
                putText(linkNode, "rel", link.getRel());
                putText(linkNode, "href", link.getHref());
            }
        }
        return document.toString();
    }

    private ObjectNode optionNode(Option option) {
        ObjectNode node = objectMapper.createObjectNode();
        putText(node, "name", option.getName());
        putText(node, "description", option.getDescription());
        putTexts(node, "positive-consequences", option.getPositiveConsequences());
        putTexts(node, "negative-consequences", option.getNegativeConsequences());
        return node;
    }

    private JsonNode readObject(String json) throws InvalidAdrDocumentException {
        JsonNode root;
        try {
            root = json == null ? null : objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new InvalidAdrDocumentException("Cannot parse ADR document as JSON");
        }
        if (root == null || !root.isObject()) {
            throw new InvalidAdrDocumentException("ADR document must be a JSON object");
        }
        return root;
    }

    private NewAdrRequest request(JsonNode root, boolean strict) throws InvalidAdrDocumentException {
        NewAdrRequest request = new NewAdrRequest();
        request.setTitle(text(root, "title", strict));
        request.setDecisionDate(decisionDate(root, strict));
        request.setRequesters(texts(root, "requesters", strict));
        request.setApprovers(texts(root, "approvers", strict));
        request.setContextAndProblemStatement(text(root, "context-and-problem-statement", strict));
        request.setDecisionDrivers(texts(root, "decision-drivers", strict));
        List<Option> options = options(root, strict);
        request.setConsideredOptions(options);
        request.setDecisionOutcome(decision(root, options, strict));
        request.setLinks(links(root, strict));
        return request;
    }

    private Status status(JsonNode root, boolean strict) throws InvalidAdrDocumentException {
        String status = text(root, "status", strict);
        if (status == null) {
            return null;
        }
        try {
            return Status.valueOf(status);
        } catch (IllegalArgumentException e) {
            if (strict) {
                throw new InvalidAdrDocumentException("Invalid status: " + status + ". Supported: " + SUPPORTED_STATUSES);
            }
            return null;
        }
    }

    private LocalDate decisionDate(JsonNode root, boolean strict) throws InvalidAdrDocumentException {
        String date = text(root, "decision-date", strict);
        if (date == null) {
            return null;
        }
        try {
            return LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            if (strict) {
                throw new InvalidAdrDocumentException("decision-date must be a date in the form yyyy-MM-dd");
            }
            return null;
        }
    }

    private List<Option> options(JsonNode root, boolean strict) throws InvalidAdrDocumentException {
        List<JsonNode> nodes = objects(root, "considered-options", strict);
        if (nodes == null) {
            return null;
        }
        List<Option> options = new ArrayList<>();
        for (JsonNode node : nodes) {
            String name = text(node, "name", strict);
            if (name == null && strict) {
                throw new InvalidAdrDocumentException("considered-options entries require a name");
            }
            options.add(new Option(name, text(node, "description", strict),
                    texts(node, "positive-consequences", strict), texts(node, "negative-consequences", strict)));
        }
        return options;
    }

    private Decision decision(JsonNode root, List<Option> options, boolean strict) throws InvalidAdrDocumentException {
        JsonNode outcome = root.get("decision-outcome");
        if (outcome == null || outcome.isNull()) {
            return null;
        }
        if (!outcome.isObject()) {
            if (strict) {
                throw new InvalidAdrDocumentException("decision-outcome must be an object");
            }
            return null;
        }
        String chosenName = text(outcome, "chosen-option", strict);
        Option chosen = null;
        if (chosenName != null) {
            String sanitisedChosenName = NewAdrRequest.SANITIZATION_POLICY.sanitize(chosenName);
            chosen = (options == null ? List.<Option>of() : options).stream()
                    .filter(option -> sanitisedChosenName.equals(option.getName()))
                    .findFirst()
                    .orElse(null);
            if (chosen == null) {
                if (strict) {
                    throw new InvalidAdrDocumentException("chosen-option " + chosenName
                            + " does not match the name of any considered-options entry");
                }
                chosen = new Option(chosenName, null, null, null);
            }
        }
        return new Decision(chosen, text(outcome, "rationale", strict));
    }

    private List<Link> links(JsonNode root, boolean strict) throws InvalidAdrDocumentException {
        List<JsonNode> nodes = objects(root, "links", strict);
        if (nodes == null) {
            return null;
        }
        List<Link> links = new ArrayList<>();
        for (JsonNode node : nodes) {
            links.add(new Link(text(node, "rel", strict), text(node, "href", strict)));
        }
        return links;
    }

    private static String text(JsonNode node, String field, boolean strict) throws InvalidAdrDocumentException {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isTextual()) {
            return value.asText();
        }
        if (strict) {
            throw new InvalidAdrDocumentException(field + " must be a string");
        }
        return null;
    }

    private static List<String> texts(JsonNode node, String field, boolean strict) throws InvalidAdrDocumentException {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isArray() || !allMatch(value, JsonNode::isTextual)) {
            if (strict) {
                throw new InvalidAdrDocumentException(field + " must be an array of strings");
            }
            return null;
        }
        List<String> texts = new ArrayList<>();
        value.forEach(item -> texts.add(item.asText()));
        return texts;
    }

    private static List<JsonNode> objects(JsonNode node, String field, boolean strict) throws InvalidAdrDocumentException {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isArray() || !allMatch(value, JsonNode::isObject)) {
            if (strict) {
                throw new InvalidAdrDocumentException(field + " must be an array of objects");
            }
            return null;
        }
        List<JsonNode> objects = new ArrayList<>();
        value.forEach(objects::add);
        return objects;
    }

    private static boolean allMatch(JsonNode array, java.util.function.Predicate<JsonNode> predicate) {
        for (JsonNode item : array) {
            if (!predicate.test(item)) {
                return false;
            }
        }
        return true;
    }

    private static void putText(ObjectNode node, String field, String value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private static void putTexts(ObjectNode node, String field, List<String> values) {
        if (values != null) {
            ArrayNode array = node.putArray(field);
            values.forEach(array::add);
        }
    }
}
