package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TestExtensionDestinationsShould {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String RESOURCE = "\"namespace\":\"north.payments\",\"type\":\"architectures\",\"id\":\"pay\",\"version\":\"1.0.0\"";

    private static JsonNode json(String text) throws Exception {
        return MAPPER.readTree(text);
    }

    private static ObjectNode screenWith(ObjectNode params) {
        ObjectNode screen = MAPPER.createObjectNode().put("extension", "reviews").put("screen", "list");
        screen.set("params", params);
        ObjectNode destination = MAPPER.createObjectNode();
        destination.set("screen", screen);
        return destination;
    }

    private static ObjectNode params(int screenParams, int tableKeys) {
        ObjectNode params = MAPPER.createObjectNode();
        for (int i = 0; i < screenParams; i++) {
            params.put("p" + i, "1");
        }
        String[] kinds = {"filter", "q", "page"};
        for (int i = 0; i < tableKeys; i++) {
            params.put("t" + (i / 3) + "." + kinds[i % 3], "2");
        }
        return params;
    }

    @Test
    void return_the_namespaces_that_the_caller_must_read() throws Exception {
        assertEquals(Optional.of(Set.of("north.payments")),
                ExtensionDestinations.destination(json("{\"hub\":{" + RESOURCE + ",\"element\":\"api\",\"extension\":\"reviews\"}}")));
        assertEquals(Optional.of(Set.of("north.payments")),
                ExtensionDestinations.destination(json("{\"screen\":{\"extension\":\"reviews\",\"screen\":\"list\",\"context\":{" + RESOURCE + "}}}")));
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(json("{\"screen\":{\"extension\":\"reviews\",\"screen\":\"list\"}}")));
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(json("{\"href\":\"https://example.org/runbook\"}")));
    }

    @Test
    void check_a_link_with_its_label() throws Exception {
        assertEquals(Optional.of(Set.of("north.payments")), ExtensionDestinations.link(json("{\"label\":\"Payments\",\"hub\":{" + RESOURCE + "}}")));
        assertEquals(Optional.empty(), ExtensionDestinations.link(json("{\"hub\":{" + RESOURCE + "}}")));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json("{\"label\":\"Payments\",\"hub\":{" + RESOURCE + "}}")));
    }

    // The schema bounds only the total (maxProperties 20), so it accepts nine screen params or thirteen table keys.
    @Test
    void count_screen_params_and_table_keys_apart() {
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(screenWith(params(8, 12))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(screenWith(params(9, 0))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(screenWith(params(0, 13))));
    }

    // '界' is three UTF-8 bytes, so nine characters form-encoded. "a=" and 227 of them make 2045 characters.
    @Test
    void bound_the_query_that_the_screen_route_gets() throws Exception {
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(screenWith(MAPPER.createObjectNode().put("a", "界".repeat(227)))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(screenWith(MAPPER.createObjectNode().put("a", "界".repeat(228)))));
        // The resource context counts too: 1173 for the element and 908 for the param.
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json(
                "{\"screen\":{\"extension\":\"reviews\",\"screen\":\"list\",\"context\":{" + RESOURCE + ",\"element\":\"" + "界".repeat(130)
                        + "\"},\"params\":{\"a\":\"" + "界".repeat(100) + "\"}}}")));
        // Table keys stay in the browser, so they do not count.
        ObjectNode withTables = params(0, 12).put("a", "界".repeat(227));
        withTables.properties().forEach(entry -> {
            if (entry.getKey().endsWith(".q")) {
                entry.setValue(MAPPER.getNodeFactory().textNode("界".repeat(200)));
            }
        });
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(screenWith(withTables)));
    }

    @Test
    void bound_a_segment_and_an_href() throws Exception {
        assertEquals(Optional.of(Set.of("n")), ExtensionDestinations.destination(json(
                "{\"hub\":{\"namespace\":\"n\",\"type\":\"architectures\",\"id\":\"" + "x".repeat(256) + "\",\"version\":\"1\"}}")));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json(
                "{\"hub\":{\"namespace\":\"n\",\"type\":\"architectures\",\"id\":\"" + "x".repeat(257) + "\",\"version\":\"1\"}}")));
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(json("{\"href\":\"https://example.org/" + "x".repeat(2048 - 20) + "\"}")));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json("{\"href\":\"https://example.org/" + "x".repeat(2049 - 20) + "\"}")));
    }

    // A browser's URL parser (new URL() in the UI's safeHref) opens each of these, so Hub must keep them.
    @ParameterizedTest
    @ValueSource(strings = {"https://example.org:65535/x", "https://example.org:/x", "https://EXAMPLE.org:0080/",
            "https://bücher.example/", "https://例え.テスト/パス?q=値#frag", "https://user:pw@example.org/", "https://[::1]:8080/",
            "https://127.0.0.1/", "http://example.org/a b", "https://example.org\\path"})
    void keep_an_href_that_a_browser_opens(String href) {
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(MAPPER.createObjectNode().put("href", href)));
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.link(MAPPER.createObjectNode().put("label", "Docs").put("href", href)));
    }

    // A browser cannot open these: the UI would show the link as text.
    @ParameterizedTest
    @ValueSource(strings = {"https://example.org:bad", "https://example.org:99999", "https://example.org:65536",
            "https://example.org:-1", "https://", "https://:80", "https://exa mple.org", "https://exa<mple.org/", "https://[::1/",
            "https://example.123"})
    void drop_an_href_that_a_browser_cannot_open(String href) {
        assertEquals(Optional.empty(), ExtensionDestinations.destination(MAPPER.createObjectNode().put("href", href)));
        assertEquals(Optional.empty(), ExtensionDestinations.link(MAPPER.createObjectNode().put("label", "Docs").put("href", href)));
    }

    // JSON Schema counts code points, as the UI does: '𝄞' is one character and two UTF-16 units.
    @Test
    void count_a_length_in_characters() throws Exception {
        String hub = "{\"hub\":{\"namespace\":\"n\",\"type\":\"architectures\",\"id\":\"%s\",\"version\":\"1\",\"element\":\"%s\"}}";
        assertEquals(Optional.of(Set.of("n")), ExtensionDestinations.destination(json(hub.formatted("𝄞".repeat(256), "𝄞".repeat(256)))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json(hub.formatted("𝄞".repeat(257), "a"))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json(hub.formatted("a", "𝄞".repeat(257)))));
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(screenWith(MAPPER.createObjectNode()
                .put("t.filter", "𝄞".repeat(100)).put("t.q", "𝄞".repeat(200)))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(screenWith(MAPPER.createObjectNode().put("t.filter", "𝄞".repeat(101)))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(screenWith(MAPPER.createObjectNode().put("t.q", "𝄞".repeat(201)))));
        String site = "https://example.org/";
        assertEquals(Optional.of(Set.of()), ExtensionDestinations.destination(MAPPER.createObjectNode().put("href", site + "𝄞".repeat(2048 - 20))));
        assertEquals(Optional.empty(), ExtensionDestinations.destination(MAPPER.createObjectNode().put("href", site + "𝄞".repeat(2049 - 20))));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            // Two kinds, or an internal path.
            "{\"href\":\"https://example.org\",\"hub\":{" + RESOURCE + "}}",
            "{\"hub\":{" + RESOURCE + ",\"path\":\"/admin\"}}",
            // Another scheme.
            "{\"href\":\"javascript:alert(1)\"}",
            // A namespace that Hub cannot have, so cannot READ-check.
            "{\"hub\":{\"namespace\":\"a/b\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1\"}}",
            "{\"screen\":{\"extension\":\"r\",\"screen\":\"s\",\"context\":{\"namespace\":\"a b\",\"type\":\"t\",\"id\":\"1\",\"version\":\"1\"}}}",
            // A control character or a lone surrogate, which cannot go in a URL.
            "{\"hub\":{" + RESOURCE + ",\"element\":\"a\\u0000\"}}",
            "{\"hub\":{\"namespace\":\"n\",\"type\":\"architectures\",\"id\":\"a\\ud800\",\"version\":\"1\"}}",
            "{\"screen\":{\"extension\":\"r\",\"screen\":\"s\",\"params\":{\"sort\":\"\\udc00\"}}}",
            // A context name as a param, a page out of range, and an unknown table key.
            "{\"screen\":{\"extension\":\"r\",\"screen\":\"s\",\"params\":{\"namespace\":\"other\"}}}",
            "{\"screen\":{\"extension\":\"r\",\"screen\":\"s\",\"params\":{\"t.page\":\"1\"}}}",
            "{\"screen\":{\"extension\":\"r\",\"screen\":\"s\",\"params\":{\"t.sort\":\"a\"}}}",
            "[]"
    })
    void refuse_what_the_ui_cannot_open(String destination) throws Exception {
        assertEquals(Optional.empty(), ExtensionDestinations.destination(json(destination)));
    }
}
