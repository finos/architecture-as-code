package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.domain.extensions.ExtensionManifest.Route;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestExtensionSearchShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ExtensionManifest MANIFEST = new ExtensionManifest("team-services", "1.0.0", 0, "Team services",
            null, null, List.of(
            new Route("screen", "GET", "/screen", "authenticated", true),
            new Route("search", "POST", "/search", "authenticated", true)),
            null, new ExtensionManifest.Contributions(null, null, null, null, null,
            List.of(new ExtensionManifest.RouteContribution("services", "Services", "search")), null, null, null, null));
    private static final String FINOS = "{\"id\":\"finos-1\",\"title\":\"Settlement\",\"namespace\":\"finos\"}";

    @TempDir
    Path tempDir;

    private final FixtureBackend backend = new FixtureBackend();
    private final ExtensionRegistry registry = mock(ExtensionRegistry.class);
    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final SecurityIdentity alice = TestExtensionProxyServiceShould.identity("alice");
    private ExtensionSearch search;

    @BeforeEach
    void setup() {
        ExtensionTestKeys.KeyFiles keys = ExtensionTestKeys.rsa(tempDir, "hub");
        SmallRyeConfig config = new SmallRyeConfigBuilder()
                .withMapping(ExtensionsConfig.class)
                .withSources(new PropertiesConfigSource(Map.of(
                        "calm.extensions.identity.private-key-location", keys.privateKey().toString(),
                        "calm.extensions.identity.public-key-locations", keys.publicKey().toString(),
                        "calm.hub.base-url", "https://hub.example.com"), "test", 100))
                .build();
        ExtensionIdentitySigner signer = new ExtensionIdentitySigner(config.getConfigMapping(ExtensionsConfig.class), config, registry);
        signer.load();
        ExtensionProxyService proxy = new ExtensionProxyService(registry, signer, permissions, mock(AuditService.class), "oidc");
        search = new ExtensionSearch(registry, proxy, permissions);
        when(permissions.canRead(any(), eq("finos"))).thenReturn(true);
        when(permissions.canRead(any(), eq("finos.payments"))).thenReturn(true);
        register(Duration.ofSeconds(5));
    }

    @AfterEach
    void teardown() {
        backend.close();
    }

    @Test
    void send_the_query_to_the_provider_route_and_return_the_results_that_the_caller_can_read() throws Exception {
        reply("""
                {"hubApi":0,"next":"page-2","results":[
                  {"id":"a","title":"Settlement engine","summary":"Owned by alice","namespace":"finos","score":9,
                   "link":{"hub":{"namespace":"finos.payments","type":"architectures","id":"7","version":"1.2.0",
                     "element":"engine","extension":"reviews"}}},
                  {"id":"hidden-1","title":"Secret merger","namespace":"secret"},
                  {"id":"hidden-2","title":"Secret link","namespace":"finos",
                   "link":{"hub":{"namespace":"secret","type":"architectures","id":"1","version":"1.0.0"}}},
                  {"id":"hidden-3","title":"Secret screen","link":{"screen":{"extension":"reviews","screen":"queue",
                     "context":{"namespace":"secret","type":"architectures","id":"1","version":"1.0.0"}}}},
                  {"id":"b","title":"Runbook","link":{"href":"https://example.org/runbook"}},
                  {"id":"c","title":"Review queue","link":{"screen":{"extension":"reviews","screen":"queue",
                     "context":{"namespace":"finos","type":"architectures","id":"7","version":"1.2.0","element":"engine"},
                     "params":{"status":"open","reviews.page":"2"}}}}
                ]}""");

        ObjectNode page = search.search(alice, "team-services", "services", "pay", "page-1");

        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("POST"));
        assertThat(received.pathAndQuery(), is("/base/search"));
        assertThat(received.header("Content-Type"), is("application/json"));
        assertThat(MAPPER.readTree(received.body()), is(MAPPER.readTree(
                "{\"hubApi\":0,\"query\":\"pay\",\"limit\":10,\"cursor\":\"page-1\"}")));
        assertThat(page, is(MAPPER.readTree("""
                {"results":[
                  {"id":"a","title":"Settlement engine","summary":"Owned by alice","namespace":"finos",
                   "link":{"hub":{"namespace":"finos.payments","type":"architectures","id":"7","version":"1.2.0",
                     "element":"engine","extension":"reviews"}}},
                  {"id":"b","title":"Runbook","link":{"href":"https://example.org/runbook"}},
                  {"id":"c","title":"Review queue","link":{"screen":{"extension":"reviews","screen":"queue",
                     "context":{"namespace":"finos","type":"architectures","id":"7","version":"1.2.0","element":"engine"},
                     "params":{"status":"open","reviews.page":"2"}}}}
                ],"next":"page-2"}""")));
        assertThat(page.toString(), not(containsString("Secret")));
        // One permission check for each namespace, also when several results name it.
        verify(permissions, times(1)).canRead(alice, "finos");
        verify(permissions, times(1)).canRead(alice, "secret");
    }

    @Test
    void send_no_cursor_for_the_first_page() throws Exception {
        reply("{\"hubApi\":0,\"results\":[]}");

        ObjectNode page = search.search(alice, "team-services", "services", "pay", null);

        assertThat(MAPPER.readTree(backend.received().body()), is(MAPPER.readTree("{\"hubApi\":0,\"query\":\"pay\",\"limit\":10}")));
        assertThat(page.toString(), is("{\"results\":[]}"));
    }

    @Test
    void leave_out_the_cursor_when_hub_left_out_every_result_of_the_page() {
        reply("{\"hubApi\":0,\"next\":\"2\",\"results\":[{\"id\":\"x\",\"title\":\"Secret\",\"namespace\":\"secret\"}]}");
        assertThat(search.search(alice, "team-services", "services", "pay", null).toString(), is("{\"results\":[]}"));

        // An empty page from the provider keeps its cursor: Hub left nothing out.
        reply("{\"hubApi\":0,\"next\":\"2\",\"results\":[]}");
        assertThat(search.search(alice, "team-services", "services", "pay", null).get("next").textValue(), is("2"));
    }

    @Test
    void keep_the_first_result_with_an_id() {
        reply("{\"hubApi\":0,\"results\":[" + FINOS + ",{\"id\":\"finos-1\",\"title\":\"Again\"},{\"id\":\"2\",\"title\":\"Other\"}],\"next\":null}");

        ObjectNode page = search.search(alice, "team-services", "services", "pay", null);

        assertThat(titles(page), contains("Settlement", "Other"));
        assertThat(page.get("next"), nullValue());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "\"not an object\"",
            "{\"title\":\"No id\"}",
            "{\"id\":\"x\",\"title\":\" \"}",
            "{\"id\":\"x\",\"title\":\"Line\\nbreak\"}",
            "{\"id\":7,\"title\":\"Number id\"}",
            "{\"id\":\"x\",\"title\":\"Bad namespace\",\"namespace\":\"fin_os\"}",
            "{\"id\":\"x\",\"title\":\"Number namespace\",\"namespace\":1}",
            "{\"id\":\"x\",\"title\":\"Link is a string\",\"link\":\"https://example.org\"}",
            "{\"id\":\"x\",\"title\":\"Two targets\",\"link\":{\"href\":\"https://example.org\",\"hub\":{}}}",
            "{\"id\":\"x\",\"title\":\"Unknown target\",\"link\":{\"url\":\"https://example.org\"}}",
            "{\"id\":\"x\",\"title\":\"Script\",\"link\":{\"href\":\"javascript:alert(1)\"}}",
            "{\"id\":\"x\",\"title\":\"No version\",\"link\":{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"1\"}}}",
            "{\"id\":\"x\",\"title\":\"Dot dot\",\"link\":{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"..\",\"version\":\"1.0.0\"}}}",
            "{\"id\":\"x\",\"title\":\"Bad extension\",\"link\":{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\",\"extension\":\"Bad\"}}}",
            "{\"id\":\"x\",\"title\":\"Hub extra\",\"link\":{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\",\"tab\":\"x\"}}}",
            "{\"id\":\"x\",\"title\":\"Hub array\",\"link\":{\"hub\":[]}}",
            "{\"id\":\"x\",\"title\":\"Screen id\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"Queue\"}}}",
            "{\"id\":\"x\",\"title\":\"Screen extra\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"url\":\"x\"}}}",
            "{\"id\":\"x\",\"title\":\"Screen array\",\"link\":{\"screen\":[]}}",
            "{\"id\":\"x\",\"title\":\"Context extra\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"context\":{\"namespace\":\"finos\",\"type\":\"a\",\"id\":\"1\",\"version\":\"1\",\"extension\":\"x\"}}}}",
            "{\"id\":\"x\",\"title\":\"Number param\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"page\":2}}}}",
            "{\"id\":\"x\",\"title\":\"Params array\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":[]}}}",
            "{\"id\":\"x\",\"title\":\"Param name\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"\":\"x\"}}}}",
            "{\"id\":\"x\",\"title\":\"Bad namespace link\",\"link\":{\"hub\":{\"namespace\":\"fin_os\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\"}}}",
            "{\"id\":\"x\",\"title\":\"Element control\",\"link\":{\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\",\"element\":\"a\\u0007\"}}}",
            "{\"id\":\"x\",\"title\":\"Ninth param\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":NINE_PARAMS}}}",
            "{\"id\":\"x\",\"title\":\"Thirteenth key\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":THIRTEEN_KEYS}}}",
            "{\"id\":\"x\",\"title\":\"Context param\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"namespace\":\"finos\"}}}}",
            "{\"id\":\"x\",\"title\":\"Long param name\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"NAME65\":\"x\"}}}}",
            "{\"id\":\"x\",\"title\":\"Long param value\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"status\":\"VALUE257\"}}}}",
            "{\"id\":\"x\",\"title\":\"Param control\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"status\":\"a\\u0001\"}}}}",
            "{\"id\":\"x\",\"title\":\"Param surrogate\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"status\":\"\\ud800\"}}}}",
            "{\"id\":\"x\",\"title\":\"Long table id\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"TABLE65.filter\":\"x\"}}}}",
            "{\"id\":\"x\",\"title\":\"Long filter\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"reviews.filter\":\"FILTER101\"}}}}",
            "{\"id\":\"x\",\"title\":\"First page\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"reviews.page\":\"1\"}}}}",
            "{\"id\":\"x\",\"title\":\"Page past the end\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"reviews.page\":\"10001\"}}}}",
            "{\"id\":\"x\",\"title\":\"Other table key\",\"link\":{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"reviews.sort\":\"x\"}}}}"
    })
    void leave_out_a_result_that_is_not_valid_and_keep_the_others(String invalid) {
        String result = invalid.replace("NINE_PARAMS", params(ExtensionDestinations.MAX_SCREEN_PARAMS + 1, ExtensionDestinations.MAX_TABLE_KEYS).toString())
                .replace("THIRTEEN_KEYS", params(ExtensionDestinations.MAX_SCREEN_PARAMS, ExtensionDestinations.MAX_TABLE_KEYS + 1).toString())
                .replace("NAME65", "n".repeat(65))
                .replace("VALUE257", "v".repeat(257))
                .replace("TABLE65", "t".repeat(65))
                .replace("FILTER101", "f".repeat(101));
        reply("{\"hubApi\":0,\"results\":[" + result + "," + FINOS + "]}");

        assertThat(titles(search.search(alice, "team-services", "services", "pay", null)), contains("Settlement"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "\"\"", "\" \"", "\"\\t\\n \"", "\"SUMMARY\"", "\"Line\\nbreak\"", "\"Bell\\u0007\"",
            "7", "true", "{\"text\":\"x\"}", "[\"x\"]"})
    void keep_a_result_without_a_summary_that_is_not_valid(String summary) {
        reply("{\"hubApi\":0,\"results\":[{\"id\":\"a\",\"title\":\"Order service\",\"summary\":"
                + summary.replace("SUMMARY", "s".repeat(ExtensionSearch.MAX_SUMMARY_LENGTH + 1)) + "}," + FINOS + "]}");

        ObjectNode page = search.search(alice, "team-services", "services", "pay", null);

        assertThat(titles(page), contains("Order service", "Settlement"));
        assertThat(page.get("results").get(0).has("summary"), is(false));
    }

    @Test
    void accept_the_largest_valid_values() {
        ObjectNode params = params(ExtensionDestinations.MAX_SCREEN_PARAMS, ExtensionDestinations.MAX_TABLE_KEYS);
        reply("{\"hubApi\":0,\"results\":[{\"id\":\"" + "i".repeat(ExtensionSearch.MAX_ID_LENGTH) + "\",\"title\":\""
                + "t".repeat(ExtensionSearch.MAX_TITLE_LENGTH) + "\",\"summary\":\"" + "s".repeat(ExtensionSearch.MAX_SUMMARY_LENGTH)
                + "\",\"namespace\":null,\"link\":{\"screen\":"
                + "{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":" + params + "}}}]}");

        ObjectNode page = search.search(alice, "team-services", "services", "pay", null);

        assertThat(page.get("results").get(0).get("link").get("screen").get("params"), is(params));
        assertThat(page.get("results").get(0).get("summary").textValue(), is("s".repeat(ExtensionSearch.MAX_SUMMARY_LENGTH)));
    }

    @Test
    void count_a_length_in_characters_not_utf16_units() {
        String clef = "\uD834\uDD1E";
        String longest = clef.repeat(ExtensionSearch.MAX_TITLE_LENGTH);
        reply("{\"hubApi\":0,\"results\":[{\"id\":\"a\",\"title\":\"" + longest + "\"},"
                + "{\"id\":\"b\",\"title\":\"" + longest + clef + "\"}]}");

        ObjectNode page = search.search(alice, "team-services", "services", clef.repeat(ExtensionSearch.MAX_QUERY_LENGTH), null);

        assertThat(titles(page), contains(longest));
        assertThat(status(clef.repeat(ExtensionSearch.MAX_QUERY_LENGTH + 1), null), is(400));
    }

    @Test
    void count_the_query_and_the_path_in_the_request_for_the_next_page() {
        // The cursor fills the request line for "pay" exactly; a longer query leaves it no room.
        String line = "GET /api/calm/extensions/team-services/search/services?q=pay&cursor= HTTP/1.1";
        String cursor = "c".repeat(ExtensionSearch.MAX_REQUEST_LINE - line.length());
        reply("{\"hubApi\":0,\"results\":[{\"id\":\"a\",\"title\":\"A\"}],\"next\":\"" + cursor + "\"}");

        assertThat(search.search(alice, "team-services", "services", "pay", null).get("next").textValue(), is(cursor));
        assertThat(status("pays", null), is(502));
    }

    @Test
    void keep_a_table_value_that_only_the_browser_reads() {
        // Table keys never go to a route, so the UI accepts a control character in a filter, and Hub does too.
        String link = "{\"screen\":{\"extension\":\"reviews\",\"screen\":\"queue\",\"params\":{\"reviews.filter\":\"a\\tb\"}}}";
        reply("{\"hubApi\":0,\"results\":[{\"id\":\"x\",\"title\":\"Tab\",\"link\":" + link + "}]}");

        assertThat(titles(search.search(alice, "team-services", "services", "pay", null)), contains("Tab"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "not json",
            "[]",
            "{\"results\":[]}",
            "{\"hubApi\":1,\"results\":[]}",
            "{\"hubApi\":\"0\",\"results\":[]}",
            "{\"hubApi\":0}",
            "{\"hubApi\":0,\"results\":{}}",
            "{\"hubApi\":0,\"results\":ELEVEN}",
            "{\"hubApi\":0,\"results\":[],\"next\":2}",
            "{\"hubApi\":0,\"results\":[],\"next\":\"\"}",
            "{\"hubApi\":0,\"results\":[],\"next\":\"\\ud800\"}"
    })
    void refuse_a_reply_that_is_not_valid(String reply) {
        StringBuilder eleven = new StringBuilder("[");
        for (int i = 0; i <= ExtensionSearch.PAGE_SIZE; i++) {
            eleven.append(i == 0 ? "" : ",").append("{\"id\":\"").append(i).append("\",\"title\":\"t\"}");
        }
        reply(reply.replace("ELEVEN", eleven + "]"));

        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> search.search(alice, "team-services", "services", "pay", null));

        assertThat(e.status(), is(502));
        assertThat(e.getMessage(), is("The search provider sent a reply that CALM Hub cannot read"));
    }

    @Test
    void fail_when_the_provider_answers_with_an_error() {
        backend.reply(FixtureBackend.Reply.json(404, "{\"error\":\"no index\"}"));
        assertThat(status("pay", null), is(502));
        backend.reply(FixtureBackend.Reply.json(500, "{}"));
        assertThat(status("pay", null), is(502));
    }

    @Test
    void time_out_a_provider_that_is_too_slow() {
        register(Duration.ofMillis(300));
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json"),
                "{\"hubApi\":0,\"results\":[]}".getBytes(), 1500));

        assertThat(status("pay", null), is(504));
    }

    @Test
    void refuse_an_unknown_extension_or_provider() {
        when(registry.find("missing")).thenReturn(Optional.empty());
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> search.search(alice, "missing", "services", "pay", null)).status(), is(404));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> search.search(alice, "team-services", "other", "pay", null)).status(), is(404));
        ExtensionManifest none = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                MANIFEST.routes(), null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(none, 0,
                Optional.of(backend.url("/base")), limits(Duration.ofSeconds(5)))));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> search.search(alice, "team-services", "services", "pay", null)).status(), is(404));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_query_or_cursor_that_is_not_valid_before_calling_the_provider() {
        String longQuery = "q".repeat(ExtensionSearch.MAX_QUERY_LENGTH + 1);
        for (String query : new String[]{null, "", "   ", longQuery, "pay\u0000"}) {
            assertThat(query, status(query, null), is(400));
        }
        for (String cursor : new String[]{"", "c\n", "\uD800", "c".repeat(ExtensionSearch.MAX_REQUEST_LINE)}) {
            assertThat(cursor, status("pay", cursor), is(400));
        }
        assertThat(backend.received(), nullValue());
    }

    private void register(Duration requestTimeout) {
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(MANIFEST, 0,
                Optional.of(backend.url("/base")), limits(requestTimeout))));
    }

    private static ExtensionLimits limits(Duration requestTimeout) {
        return new ExtensionLimits(Duration.ofSeconds(2), requestTimeout, 1024 * 1024, 1024 * 1024, 32);
    }

    private void reply(String json) {
        backend.reply(FixtureBackend.Reply.json(200, json));
    }

    private int status(String query, String cursor) {
        return assertThrows(ExtensionProxyException.class,
                () -> search.search(alice, "team-services", "services", query, cursor)).status();
    }

    private static List<String> titles(ObjectNode page) {
        return StreamSupport.stream(page.get("results").spliterator(), false)
                .map(result -> result.get("title").textValue()).toList();
    }

    /**
     * The given number of screen params and table keys, at the limits of each: the longest names, an empty value, the
     * longest value and the last page.
     */
    private static ObjectNode params(int screenParams, int tableKeys) {
        ObjectNode params = MAPPER.createObjectNode();
        for (int i = 0; i < screenParams; i++) {
            String name = i == 0 ? "P" + "n".repeat(63) : "p" + i;
            params.put(name, i == 1 ? "" : i == 2 ? "v".repeat(256) : "v");
        }
        String[] kinds = {".filter", ".q", ".page"};
        for (int i = 0; i < tableKeys; i++) {
            String table = i == 0 ? "t".repeat(64) : "table-" + i;
            String kind = kinds[i % 3];
            String value = switch (kind) {
                case ".filter" -> i == 0 ? "" : "f".repeat(100);
                case ".q" -> "q".repeat(200);
                default -> "10000";
            };
            params.put(table + kind, value);
        }
        return params;
    }
}
