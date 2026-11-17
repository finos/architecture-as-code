package org.finos.calm.extensions;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.function.Predicate;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestExtensionChatShould {

    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final ExtensionHubData hubData = mock(ExtensionHubData.class);
    private final SecurityIdentity alice = TestExtensionProxyServiceShould.identity("alice");
    private final ExtensionChat chat = new ExtensionChat(permissions, hubData);
    private static final String FINOS = "{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"7\",\"version\":\"1.0.0\"}";

    @BeforeEach
    void setup() {
        when(permissions.canRead(any(), eq("finos"))).thenReturn(true);
        when(permissions.canRead(any(), eq("secret"))).thenReturn(false);
        when(hubData.read(anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(hubData.read("finos", "architectures", "7", "1.0.0"))
                .thenReturn(Optional.of(new JsonObject().put("nodes", new JsonArray())));
    }

    private static JsonObject message() {
        return new JsonObject()
                .put("conversationId", "c-1")
                .put("messageId", "m-1")
                .put("messages", new JsonArray()
                        .add(new JsonObject().put("role", "user").put("content", "Explain payments"))
                        .add(new JsonObject().put("role", "assistant").put("content", "It is a platform"))
                        .add(new JsonObject().put("role", "user").put("content", "And the ledger?")));
    }

    private static JsonObject context(String namespace) {
        return new JsonObject().put("namespace", namespace).put("resourceType", "architectures").put("resourceId", "7")
                .put("version", "1.0.0");
    }

    private JsonObject body(JsonObject request) {
        return new JsonObject(new String(chat.body(alice, request.encode().getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8));
    }

    private int refusal(JsonObject request) {
        return assertThrows(ExtensionProxyException.class,
                () -> chat.body(alice, request.encode().getBytes(StandardCharsets.UTF_8))).status();
    }

    @Test
    void send_the_checked_messages_with_no_context_and_drop_unknown_fields() {
        JsonObject request = message().put("debug", true);
        request.getJsonArray("messages").getJsonObject(0).put("name", "x");

        JsonObject body = body(request);

        assertThat(body, equalTo(new JsonObject()
                .put("hubApi", 0).put("conversationId", "c-1").put("messageId", "m-1")
                .put("messages", message().getJsonArray("messages"))));
        verify(hubData, never()).read(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void add_the_document_of_a_shared_context_that_the_caller_can_read() {
        JsonObject body = body(message().put("context", context("finos").put("selectedElement", "payments-api")));

        assertThat(body.getJsonObject("context"), equalTo(context("finos").put("selectedElement", "payments-api")
                .put("document", new JsonObject().put("nodes", new JsonArray()))));
    }

    @Test
    void refuse_a_context_in_a_namespace_that_the_caller_cannot_read_before_reading_it() {
        assertThat(refusal(message().put("context", context("secret"))), is(403));
        verify(hubData, never()).read(eq("secret"), anyString(), anyString(), anyString());
    }

    @Test
    void refuse_a_context_whose_version_is_not_there() {
        assertThat(refusal(message().put("context", context("finos").put("version", "9.9.9"))), is(404));
    }

    @Test
    void refuse_a_context_that_does_not_name_a_resource_version() {
        assertThat(refusal(message().put("context", context("finos").put("resourceType", "flows"))), is(400));
        assertThat(refusal(message().put("context", context("finos").put("resourceId", "../7"))), is(400));
        assertThat(refusal(message().put("context", context("fin_os"))), is(400));
        assertThat(refusal(message().put("context", context("finos").put("selectedElement", "a\nb"))), is(400));
        assertThat(refusal(message().put("context", "finos")), is(400));
    }

    @Test
    void refuse_a_message_that_breaks_the_contract() {
        assertThat(refusal(message().put("conversationId", "has space")), is(400));
        assertThat(refusal(message().put("messageId", "x".repeat(65))), is(400));
        assertThat(refusal(message().put("messages", new JsonArray())), is(400));
        assertThat(refusal(message().put("messages", new JsonArray().add(new JsonObject().put("role", "system").put("content", "x")))), is(400));
        assertThat(refusal(message().put("messages", new JsonArray().add(new JsonObject().put("role", "user").put("content", " ")))), is(400));
        assertThat(refusal(message().put("messages", new JsonArray().add(new JsonObject().put("role", "user")
                .put("content", "x".repeat(ExtensionChat.MAX_MESSAGE_CHARS + 1))))), is(400));
        JsonArray many = new JsonArray();
        for (int i = 0; i <= ExtensionChat.MAX_MESSAGES; i++) {
            many.add(new JsonObject().put("role", "user").put("content", "x"));
        }
        assertThat(refusal(message().put("messages", many)), is(400));
        JsonArray lastFromAssistant = message().getJsonArray("messages").copy();
        lastFromAssistant.remove(2);
        assertThat(refusal(message().put("messages", lastFromAssistant)), is(400));
        assertThrows(ExtensionProxyException.class, () -> chat.body(alice, "[1]".getBytes(StandardCharsets.UTF_8)));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"label\":\"Payments\",\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\",\"id\":\"7\",\"version\":\"1.0.0\"}}",
            "{\"label\":\"Runbook\",\"href\":\"https://runbooks.example.com/payments\"}",
            "{\"label\":\"Reviews\",\"screen\":{\"extension\":\"assurance\",\"screen\":\"reviews\"}}",
            "{\"label\":\"Review\",\"screen\":{\"extension\":\"assurance\",\"screen\":\"reviews\",\"context\":" + FINOS
                    + ",\"params\":{\"status\":\"open\"}}}"
    })
    void pass_on_a_citation_that_the_caller_can_open(String data) {
        assertThat(chat.citations(alice).test(new ExtensionEventStream.Event("citation", data)), is(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"label\":\"Secret\",\"hub\":{\"namespace\":\"secret\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\"}}",
            "{\"label\":\"Secret review\",\"screen\":{\"extension\":\"assurance\",\"screen\":\"r\",\"context\":"
                    + "{\"namespace\":\"secret\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\"}}}",
            "{\"label\":\"Partial context\",\"screen\":{\"extension\":\"assurance\",\"screen\":\"r\",\"context\":{\"namespace\":\"finos\"}}}",
            "{\"label\":\"Context param\",\"screen\":{\"extension\":\"assurance\",\"screen\":\"r\",\"params\":{\"namespace\":\"secret\"}}}",
            "{\"label\":\"Dot segment\",\"hub\":{\"namespace\":\"finos\",\"type\":\"..\",\"id\":\"7\",\"version\":\"1.0.0\"}}",
            "{\"label\":\"Duplicate\",\"hub\":{\"namespace\":\"finos\",\"namespace\":\"secret\",\"type\":\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\"}}",
            "{\"label\":\"Trailing\",\"href\":\"https://a.example.com\"} {\"label\":\"x\"}",
            "{\"label\":\"Extra\",\"href\":\"https://a.example.com\",\"note\":\"x\"}",
            "{\"label\":\"Script\",\"href\":\"javascript:alert(1)\"}",
            "{\"label\":\"Both\",\"href\":\"https://a.example.com\",\"hub\":{\"namespace\":\"finos\"}}",
            "{\"label\":\"None\"}",
            "{\"label\":\" \",\"href\":\"https://a.example.com\"}",
            "{\"href\":\"https://a.example.com\"}",
            "{\"label\":\"Bad namespace\",\"hub\":{\"namespace\":\"fin_os\"}}",
            "{\"label\":\"No extension\",\"screen\":{\"screen\":\"r\"}}",
            "{\"label\":\"No screen\",\"screen\":{\"extension\":\"assurance\"}}",
            "not json"
    })
    void leave_out_a_citation_that_the_caller_cannot_open_or_that_is_not_valid(String data) {
        assertThat(chat.citations(alice).test(new ExtensionEventStream.Event("citation", data)), is(false));
    }

    @Test
    void leave_out_a_citation_with_a_label_longer_than_the_chat_shows() {
        String citation = "{\"label\":\"%s\",\"href\":\"https://a.example.com\"}";
        Predicate<ExtensionEventStream.Event> filter = chat.citations(alice);

        assertThat(filter.test(new ExtensionEventStream.Event("citation", citation.formatted("x".repeat(ExtensionChat.MAX_LABEL_CHARS)))), is(true));
        assertThat(filter.test(new ExtensionEventStream.Event("citation", citation.formatted("x".repeat(ExtensionChat.MAX_LABEL_CHARS + 1)))), is(false));
    }

    @Test
    void pass_on_every_other_event() {
        Predicate<ExtensionEventStream.Event> filter = chat.citations(alice);

        assertThat(filter.test(new ExtensionEventStream.Event("delta", "not checked")), is(true));
        assertThat(filter.test(new ExtensionEventStream.Event("done", "{}")), is(true));
    }
}
