package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

import static org.finos.calm.extensions.TestExtensionFormsShould.reviewForm;
import static org.finos.calm.extensions.TestExtensionFormsShould.withForm;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestExtensionFormServiceShould {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String SUBMISSION = "3f1beb2b-bded-4fda-96cc-1af7192f24b6";
    private static final String CONTEXT = "{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":\"7\","
            + "\"version\":\"1.0.0\",\"selectedElement\":\"payments-api\"}";
    private static final String INPUT = "{\"reviewType\":\"design\",\"note\":\"Check the ledger\",\"confirm\":true}";

    @TempDir
    Path tempDir;

    private final FixtureBackend backend = new FixtureBackend();
    private final ExtensionRegistry registry = mock(ExtensionRegistry.class);
    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final AuditService auditService = mock(AuditService.class);
    private final SecurityIdentity alice = TestExtensionProxyServiceShould.identity("alice");
    private ExtensionProxyService proxy;
    private ExtensionFormService forms;

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
        proxy = new ExtensionProxyService(registry, signer, permissions, auditService, "oidc");
        forms = new ExtensionFormService(registry, proxy);
        when(permissions.canWrite(any(), any())).thenReturn(true);
        register(Duration.ofSeconds(5), 32);
    }

    @AfterEach
    void teardown() {
        backend.close();
    }

    private void register(Duration timeout, int maxConcurrentCalls) {
        ExtensionManifest manifest = new ExtensionManifestLoader().parse(withForm(reviewForm()).encode(), "team-services", "test");
        ExtensionLimits limits = new ExtensionLimits(Duration.ofSeconds(2), timeout, 4096, 4096, maxConcurrentCalls);
        when(registry.find("team-services")).thenReturn(Optional.of(
                new RegisteredExtension(manifest, 0, Optional.of(backend.url("/base")), limits)));
    }

    private ExtensionProxyResponse submit(String json) {
        return forms.submit(alice, "team-services", "request-review", "application/json", "en-GB", null,
                new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
    }

    private ExtensionProxyException refused(String json) {
        return assertThrows(ExtensionProxyException.class, () -> submit(json));
    }

    private static String body(String context, String input) {
        return "{\"submission\":\"" + SUBMISSION + "\",\"context\":" + context + ",\"input\":" + input + "}";
    }

    private AuditLogEntry audited() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        return captor.getValue();
    }

    @Test
    void send_the_pinned_target_and_only_the_checked_input_to_the_form_route() throws IOException {
        backend.reply(FixtureBackend.Reply.json(201, "{\"message\":\"Review RR-1 saved\"}"));

        ExtensionProxyResponse reply = submit(body(CONTEXT,
                "{\"reviewType\":\"design\",\"note\":\"Check the ledger\",\"title\":\"\",\"confirm\":true}"));

        assertThat(reply.status(), is(201));
        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("POST"));
        assertThat(received.pathAndQuery(), is("/base/namespaces/finos/reviews"));
        assertThat(JSON.readTree(received.body()), equalTo(JSON.readTree("{\"submission\":\"" + SUBMISSION + "\","
                + "\"context\":{\"namespace\":\"finos\",\"resource\":\"architectures/7\",\"resourceType\":\"architectures\","
                + "\"resourceId\":\"7\",\"version\":\"1.0.0\",\"selectedElement\":\"payments-api\"},"
                + "\"input\":{\"reviewType\":\"design\",\"note\":\"Check the ledger\",\"confirm\":true}}")));
        AuditLogEntry entry = audited();
        assertThat(entry.getOutcome(), is(AuditOutcome.SUCCESS));
        assertThat(entry.getRoute(), is("request-review"));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getJti() != null, is(true));
    }

    @Test
    void refuse_input_that_the_fields_do_not_accept_after_the_scope_check_and_audit_it() {
        ExtensionFormInputException e = assertThrows(ExtensionFormInputException.class,
                () -> submit(body(CONTEXT, "{\"reviewType\":\"cost\",\"note\":\"\",\"confirm\":false}")));

        assertThat(e.status(), is(422));
        assertThat(e.fields(), equalTo(Map.of("reviewType", "Choose one of the options.", "note", "Enter a value.",
                "confirm", "Tick this box to continue.")));
        assertThat(backend.received(), nullValue());
        AuditLogEntry entry = audited();
        assertThat(entry.getOutcome(), is(AuditOutcome.FAILURE));
        assertThat(entry.getJti(), nullValue());
    }

    @Test
    void check_the_scope_before_the_input_so_a_caller_with_no_scope_learns_nothing_from_it() {
        when(permissions.canWrite(any(), any())).thenReturn(false);

        ExtensionProxyException e = refused(body(CONTEXT, "{\"reviewType\":\"cost\"}"));

        assertThat(e.status(), is(403));
        assertThat(e instanceof ExtensionFormInputException, is(false));
        assertThat(backend.received(), nullValue());
        assertThat(audited().getOutcome(), is(AuditOutcome.DENIED));
    }

    @Test
    void refuse_a_target_that_is_missing_has_other_names_or_disagrees_with_itself() {
        for (String context : new String[]{
                "{}",
                "{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":\"7\"}",
                "{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":\"7\",\"version\":\"1.0.0\",\"domain\":\"x\"}",
                "{\"namespace\":\"finos\",\"resourceType\":\"flows\",\"resourceId\":\"7\",\"version\":\"1.0.0\"}",
                "{\"namespace\":\"fin_os\",\"resourceType\":\"architectures\",\"resourceId\":\"7\",\"version\":\"1.0.0\"}",
                "{\"namespace\":\"finos\",\"resource\":\"architectures/8\",\"resourceType\":\"architectures\",\"resourceId\":\"7\",\"version\":\"1.0.0\"}",
                "{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":7,\"version\":\"1.0.0\"}",
                "{\"namespace\":\"finos\",\"resourceType\":\"architectures\",\"resourceId\":\"7\",\"version\":\"1.0.0\",\"selectedElement\":\"a\\nb\"}",
                "[]"}) {
            assertThat(context, refused(body(context, INPUT)).status(), is(400));
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_submission_id_that_is_not_a_uuid_and_a_field_that_a_submission_does_not_have() {
        assertThat(refused("{\"submission\":\"1\",\"context\":" + CONTEXT + ",\"input\":" + INPUT + "}").status(), is(400));
        assertThat(refused("{\"submission\":\"" + SUBMISSION.toUpperCase() + "\",\"context\":" + CONTEXT + ",\"input\":"
                + INPUT + "}").status(), is(400));
        assertThat(refused("{\"submission\":\"" + SUBMISSION + "\",\"context\":" + CONTEXT + ",\"input\":" + INPUT
                + ",\"route\":\"other\"}").status(), is(400));
        assertThat(refused("not json").status(), is(400));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_body_that_is_not_json() {
        ExtensionProxyException e = assertThrows(ExtensionProxyException.class, () -> forms.submit(alice, "team-services",
                "request-review", "text/plain", null, null, new ByteArrayInputStream(new byte[0])));
        assertThat(e.status(), is(415));
    }

    @Test
    void return_404_for_a_form_that_is_not_declared() {
        ExtensionProxyException e = assertThrows(ExtensionProxyException.class, () -> forms.submit(alice, "team-services",
                "missing", "application/json", null, null, new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8))));
        assertThat(e.status(), is(404));
    }

    @Test
    void refuse_the_form_route_through_the_generic_proxy_so_its_checks_cannot_be_skipped() {
        ExtensionProxyRequest direct = new ExtensionProxyRequest("team-services", "POST", "/namespaces/finos/reviews", null,
                "application/json", null, null, new ByteArrayInputStream("{\"anything\":true}".getBytes(StandardCharsets.UTF_8)));

        ExtensionProxyException call = assertThrows(ExtensionProxyException.class, () -> proxy.call(alice, direct));
        ExtensionProxyException check = assertThrows(ExtensionProxyException.class, () -> proxy.checkAccess(alice, direct));

        assertThat(call.status(), is(404));
        assertThat(call.getMessage(), is("Call this extension route through its CALM Hub endpoint"));
        assertThat(check.status(), is(404));
        assertThat(backend.received(), nullValue());
        verify(auditService, never()).record(any());
    }

    @Test
    void refuse_a_dedicated_call_whose_path_matches_another_route() {
        ExtensionProxyRequest other = new ExtensionProxyRequest("team-services", "POST", "/namespaces/finos/services", null,
                "application/json", null, null, null);

        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> proxy.callDedicated(alice, other, "request-review", () -> "{}".getBytes(StandardCharsets.UTF_8)));

        assertThat(e.status(), is(404));
        assertThat(backend.received(), nullValue());
    }

    @ParameterizedTest
    @ValueSource(ints = {500, 503})
    void report_a_backend_server_error_as_502_and_audit_an_unknown_outcome(int status) {
        backend.reply(FixtureBackend.Reply.json(status, "{\"error\":\"The extension is busy. Try again later\"}"));

        assertThat(refused(body(CONTEXT, INPUT)).status(), is(502));
        assertThat(audited().getOutcome(), is(AuditOutcome.UNKNOWN));
    }

    @Test
    void report_a_timeout_after_the_backend_got_the_call_as_504_and_audit_an_unknown_outcome() {
        register(Duration.ofMillis(300), 32);
        backend.reply(new FixtureBackend.Reply(201, Map.of("Content-Type", "application/json"), "{}".getBytes(StandardCharsets.UTF_8), 1500));

        assertThat(refused(body(CONTEXT, INPUT)).status(), is(504));
        assertThat(backend.received().body().contains(SUBMISSION), is(true));
        assertThat(audited().getOutcome(), is(AuditOutcome.UNKNOWN));
    }

    @Test
    void pass_on_a_backend_client_error_with_its_body() {
        backend.reply(FixtureBackend.Reply.json(409, "{\"title\":\"A review is already open\"}"));

        ExtensionProxyResponse reply = submit(body(CONTEXT, INPUT));

        assertThat(reply.status(), is(409));
        assertThat(new String(reply.body(), StandardCharsets.UTF_8), is("{\"title\":\"A review is already open\"}"));
        assertThat(audited().getOutcome(), is(AuditOutcome.FAILURE));
    }

    @Test
    void refuse_a_submission_while_the_extension_is_busy_without_sending_it() throws Exception {
        register(Duration.ofSeconds(5), 1);
        backend.reply(new FixtureBackend.Reply(201, Map.of("Content-Type", "application/json"), "{}".getBytes(StandardCharsets.UTF_8), 800));
        Thread first = new Thread(() -> submit(body(CONTEXT, INPUT)));
        first.start();
        while (backend.received() == null) {
            Thread.sleep(10);
        }

        ExtensionProxyException e = refused(body(CONTEXT, INPUT.replace("ledger", "queue")));
        first.join();

        assertThat(e.status(), is(503));
        assertThat(backend.received().body().contains("ledger"), is(true));
    }

    @Test
    void accept_a_whole_number_written_with_a_decimal_point() throws IOException {
        submit(body(CONTEXT, "{\"reviewType\":\"design\",\"note\":\"Check the ledger\",\"confirm\":true,\"priority\":4.0}"));

        JsonNode sent = JSON.readTree(backend.received().body());
        assertThat(sent.get("input").get("priority").decimalValue().compareTo(java.math.BigDecimal.valueOf(4)), is(0));
    }
}
