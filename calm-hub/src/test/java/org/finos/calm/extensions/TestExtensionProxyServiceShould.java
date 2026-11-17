package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.domain.extensions.ExtensionManifest.Route;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.Principal;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestExtensionProxyServiceShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    static final ExtensionManifest MANIFEST = new ExtensionManifest("team-services", "1.0.0", 0, "Team services",
            null, null, List.of(
            new Route("screen", "GET", "/screen", "authenticated", false),
            new Route("services", "GET", "/namespaces/{namespace}/services", "read", false),
            new Route("add-service", "POST", "/namespaces/{namespace}/services", "write", false),
            new Route("search", "POST", "/search", "authenticated", true)),
            null, null);

    @TempDir
    Path tempDir;

    private final FixtureBackend backend = new FixtureBackend();
    private final ExtensionRegistry registry = mock(ExtensionRegistry.class);
    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final AuditService auditService = mock(AuditService.class);
    private final SecurityIdentity alice = identity("alice");
    private ExtensionProxyService service;

    private ExtensionIdentitySigner signer;

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
        signer = new ExtensionIdentitySigner(config.getConfigMapping(ExtensionsConfig.class),
                config, registry);
        signer.load();
        service = new ExtensionProxyService(registry, signer, permissions, auditService, "oidc");
        when(permissions.canRead(any(), any())).thenReturn(true);
        when(permissions.canWrite(any(), any())).thenReturn(true);
        register(backend.url("/base"), limits(1024, 1024, Duration.ofSeconds(5)));
    }

    @AfterEach
    void teardown() {
        backend.close();
    }

    @Test
    void send_a_get_with_the_assertion_and_the_canonical_query() throws IOException {
        backend.reply(new FixtureBackend.Reply(200, Map.of(
                "Content-Type", "application/json; charset=utf-8",
                "ETag", "\"v1\"",
                "Cache-Control", "no-store",
                "Set-Cookie", "session=x",
                "Location", "https://evil.example.com",
                "X-Backend", "internal"), "{\"services\":[]}".getBytes(StandardCharsets.UTF_8), 0));

        ExtensionProxyResponse reply = service.call(alice, request("GET", "/namespaces/finos.payments/services",
                "tag=b&q=x&tag=a", null));

        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("GET"));
        assertThat(received.pathAndQuery(), is("/base/namespaces/finos.payments/services?q=x&tag=b&tag=a"));
        assertThat(received.header("Accept"), is("application/json"));
        assertThat(received.header("Accept-Language"), is("en-GB"));
        assertThat(received.header("Authorization"), nullValue());
        assertThat(received.header("Cookie"), nullValue());
        JsonNode claims = claims(received.header("X-Calm-Hub-Identity"));
        assertThat(claims.get("iss").asText(), is("https://hub.example.com"));
        assertThat(claims.get("sub").asText(), is("alice"));
        assertThat(claims.get("aud").asText(), is("team-services"));
        assertThat(claims.get("auth").asText(), is("oidc"));
        assertThat(claims.get("route").asText(), is("services"));
        assertThat(claims.get("scope").asText(), is("read"));
        assertThat(claims.get("ns").asText(), is("finos.payments"));
        assertThat(claims.get("htm").asText(), is("GET"));
        assertThat(claims.get("htp").asText(), is("/namespaces/finos.payments/services?q=x&tag=b&tag=a"));
        assertThat(reply.status(), is(200));
        assertThat(new String(reply.body(), StandardCharsets.UTF_8), is("{\"services\":[]}"));
        assertThat(reply.headers(), equalTo(Map.of(
                "Content-Type", "application/json; charset=utf-8", "Cache-Control", "private, no-store", "ETag", "\"v1\"")));
    }

    @Test
    void mark_each_reply_private_so_that_a_shared_cache_does_not_keep_it() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json",
                "Cache-Control", "public, max-age=600"), "{}".getBytes(StandardCharsets.UTF_8), 0));
        assertThat(service.call(alice, request("GET", "/screen", null, null)).headers().get("Cache-Control"),
                is("private, max-age=600"));

        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        assertThat(service.call(alice, request("GET", "/screen", null, null)).headers().get("Cache-Control"),
                is("private"));
    }

    @Test
    void keep_quoted_cache_directives_whole() {
        assertThat(ExtensionProxyService.privateCacheControl("PUBLIC, no-cache=\"Set-Cookie, ETag\", private=\"x\""),
                is("private, no-cache=\"Set-Cookie, ETag\""));
        assertThat(ExtensionProxyService.privateCacheControl(" , no-store"), is("private, no-store"));
    }

    @Test
    void refuse_a_body_that_is_not_json_before_signing() {
        for (String type : new String[]{"text/plain", "application/x-www-form-urlencoded", "multipart/form-data",
                "text/json", null}) {
            ExtensionProxyRequest form = new ExtensionProxyRequest("team-services", "POST", "/search", null, type,
                    null, null, new ByteArrayInputStream("{\"q\":\"pay\"}".getBytes(StandardCharsets.UTF_8)));

            assertThat(String.valueOf(type), status(form), is(415));
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    void accept_a_json_media_type() {
        for (String type : new String[]{"application/json; charset=utf-8", "Application/JSON",
                "application/merge-patch+json"}) {
            ExtensionProxyRequest json = new ExtensionProxyRequest("team-services", "POST", "/search", null, type,
                    null, null, new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));

            assertThat(type, service.call(alice, json).status(), is(200));
        }
    }

    @Test
    void refuse_an_empty_post_that_is_not_json_before_signing() throws IOException {
        for (String type : new String[]{"text/plain", "application/x-www-form-urlencoded", "multipart/form-data", null}) {
            for (ByteArrayInputStream body : new ByteArrayInputStream[]{new ByteArrayInputStream(new byte[0]), null}) {
                ExtensionProxyRequest empty = new ExtensionProxyRequest("team-services", "POST", "/search", null, type,
                        null, null, body);

                assertThat(String.valueOf(type), status(empty), is(415));
            }
        }
        assertThat(backend.received(), nullValue());

        ExtensionProxyRequest json = new ExtensionProxyRequest("team-services", "POST", "/search", null,
                "application/json", null, null, new ByteArrayInputStream(new byte[0]));
        assertThat(service.call(alice, json).status(), is(200));
        assertThat(claims(backend.received().header("X-Calm-Hub-Identity")).has("bdh"), is(false));
    }

    @Test
    void refuse_a_busy_extension_before_hub_reads_its_data() {
        ExtensionHubData hubData = mock(ExtensionHubData.class);
        Route lens = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true, List.of("document"));
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(lens), null, null);
        service = new ExtensionProxyService(registry, signer, permissions, auditService, hubData, "oidc");
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 1024, 1024, 0))));

        assertThat(status(request("POST", "/lens/finos/architectures/7", "version=1.0.0", "{}")), is(503));
        verify(hubData, never()).body(any(), any(), any(), any());
    }

    @Test
    void send_no_identity_to_an_extension_that_the_operator_set_to_send_none() {
        ExtensionHubData hubData = mock(ExtensionHubData.class);
        Route lens = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true, List.of("document"));
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(lens), null, null);
        service = new ExtensionProxyService(registry, signer, permissions, auditService, hubData, "oidc");
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)), false)));
        String hubBody = "{\"hubApi\":0,\"document\":{\"nodes\":[]}}";
        when(hubData.body(any(), any(), any(), any())).thenReturn(hubBody.getBytes(StandardCharsets.UTF_8));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));

        service.call(alice, request("POST", "/lens/finos/architectures/7", "version=1.0.0", "{}"));

        FixtureBackend.Received received = backend.received();
        assertThat(received.body(), is(hubBody));
        assertThat(received.header("X-Calm-Hub-Identity"), nullValue());
    }

    @Test
    void send_the_data_that_hub_read_in_place_of_the_body_of_the_caller_and_sign_it() throws Exception {
        ExtensionHubData hubData = mock(ExtensionHubData.class);
        Route lens = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true, List.of("document"));
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(lens), null, null);
        service = new ExtensionProxyService(registry, signer, permissions, auditService, hubData, "oidc");
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(64, 1024, Duration.ofSeconds(5)))));
        String hubBody = "{\"hubApi\":0,\"document\":{\"nodes\":[]}}";
        when(hubData.body(eq(alice), eq(lens), eq(Map.of("namespace", "finos", "resourceType", "architectures", "resourceId", "7")),
                eq("version=1.0.0"))).thenReturn(hubBody.getBytes(StandardCharsets.UTF_8));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));

        service.call(alice, new ExtensionProxyRequest("team-services", "POST", "/lens/finos/architectures/7", "version=1.0.0",
                "application/x+json; charset=utf-16", "application/json", "en-GB",
                new ByteArrayInputStream("{\"document\":\"forged\"}".getBytes(StandardCharsets.UTF_8))));

        FixtureBackend.Received received = backend.received();
        assertThat(received.body(), is(hubBody));
        assertThat(received.header("Content-Type"), is("application/json"));
        String hash = Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(hubBody.getBytes(StandardCharsets.UTF_8)));
        assertThat(claims(received.header("X-Calm-Hub-Identity")).get("bdh").asText(), is(hash));

        when(hubData.body(any(), any(), any(), any())).thenReturn(new byte[65]);
        assertThat(status(request("POST", "/lens/finos/architectures/7", "version=1.0.0", "{}")), is(413));
    }

    @Test
    void accept_an_empty_put_patch_or_delete_of_any_type_but_not_a_non_json_body() {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new Route("put", "PUT", "/item", "authenticated", false),
                        new Route("patch", "PATCH", "/item", "authenticated", false),
                        new Route("delete", "DELETE", "/item", "authenticated", false)), null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));

        for (String method : new String[]{"PUT", "PATCH", "DELETE"}) {
            assertThat(method, service.call(alice, new ExtensionProxyRequest("team-services", method, "/item", null,
                    "text/plain", null, null, new ByteArrayInputStream(new byte[0]))).status(), is(200));
            assertThat(method, status(new ExtensionProxyRequest("team-services", method, "/item", null, "text/plain",
                    null, null, new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)))), is(415));
        }
    }

    @Test
    void audit_a_415_on_a_write_route_and_not_on_a_read_only_route() {
        assertThat(status(new ExtensionProxyRequest("team-services", "POST", "/namespaces/finos/services", null,
                "text/plain", null, null, null)), is(415));
        assertThat(status(new ExtensionProxyRequest("team-services", "POST", "/search", null, "text/plain", null,
                null, null)), is(415));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(AuditOutcome.FAILURE));
        assertThat(captor.getValue().getRoute(), is("add-service"));
        assertThat(captor.getValue().getNamespace(), is("finos"));
        assertThat(captor.getValue().getJti(), nullValue());
    }

    @Test
    void bind_the_body_in_the_assertion() throws Exception {
        service.call(alice, request("POST", "/search", null, "{\"q\":\"pay\"}"));
        String expected = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256")
                .digest("{\"q\":\"pay\"}".getBytes(StandardCharsets.UTF_8)));
        assertThat(claims(backend.received().header("X-Calm-Hub-Identity")).get("bdh").asText(), is(expected));

        backend.reset();
        service.call(alice, request("GET", "/screen", null, null));
        assertThat(claims(backend.received().header("X-Calm-Hub-Identity")).has("bdh"), is(false));
    }

    @ParameterizedTest
    @CsvSource({"authenticated,false", "global_admin,false", "domain_read,false", "domain_write,false",
            "domain_admin,false", "read,true", "write,true", "admin,true"})
    void send_and_audit_ns_only_for_a_scope_that_checks_the_namespace(String scope, boolean sendsNs)
            throws IOException {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new Route("route", "GET", "/domains/{domain}/namespaces/{namespace}", scope, false)), null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));
        when(permissions.hasGlobalAdmin(alice)).thenReturn(true);
        when(permissions.allowNamespaceAdmin(alice, "finos")).thenReturn(true);
        when(permissions.canReadByDomain(alice, "payments")).thenReturn(true);
        when(permissions.canWriteByDomain(alice, "payments")).thenReturn(true);
        when(permissions.allowDomainAdmin(alice, "payments")).thenReturn(true);

        service.call(alice, request("GET", "/domains/payments/namespaces/finos", null, null));

        JsonNode claims = claims(backend.received().header("X-Calm-Hub-Identity"));
        assertThat(claims.has("ns"), is(sendsNs));
        if (sendsNs) {
            assertThat(claims.get("ns").asText(), is("finos"));
        }
        boolean sendsDom = scope.startsWith("domain_");
        assertThat(claims.has("dom"), is(sendsDom));
        if (sendsDom) {
            assertThat(claims.get("dom").asText(), is("payments"));
        }

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getNamespace(), is(sendsNs ? "finos" : null));
        assertThat(captor.getValue().getDomain(), is(scope.startsWith("domain_") ? "payments" : null));
    }

    @Test
    void audit_a_denied_call_with_only_the_checked_namespace_and_domain() {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new Route("route", "GET", "/domains/{domain}/namespaces/{namespace}", "domain_read", false)),
                null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));

        assertThat(status(request("GET", "/domains/payments/namespaces/finos", null, null)), is(403));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(AuditOutcome.DENIED));
        assertThat(captor.getValue().getNamespace(), nullValue());
        assertThat(captor.getValue().getDomain(), is("payments"));
    }

    @Test
    void send_a_post_body_with_its_content_type() {
        backend.reply(new FixtureBackend.Reply(204, Map.of(), new byte[0], 0));

        ExtensionProxyResponse reply = service.call(alice, request("POST", "/search", null, "{\"q\":\"pay\"}"));

        assertThat(backend.received().method(), is("POST"));
        assertThat(backend.received().body(), is("{\"q\":\"pay\"}"));
        assertThat(backend.received().header("Content-Type"), is("application/json"));
        assertThat(reply.status(), is(204));
        assertThat(reply.body().length, is(0));
    }

    @Test
    void pass_on_a_client_error_from_the_backend() {
        backend.reply(FixtureBackend.Reply.json(404, "{\"error\":\"no such team\"}"));

        assertThat(service.call(alice, request("GET", "/screen", null, null)).status(), is(404));
    }

    @Test
    void pass_on_a_problem_json_client_error() {
        String problem = "{\"title\":\"Name is taken\",\"status\":409}";
        backend.reply(new FixtureBackend.Reply(409, Map.of("Content-Type", "application/problem+json"),
                problem.getBytes(StandardCharsets.UTF_8), 0));

        ExtensionProxyResponse reply = service.call(alice, request("GET", "/screen", null, null));

        assertThat(reply.status(), is(409));
        assertThat(reply.headers().get("Content-Type"), is("application/problem+json"));
        assertThat(new String(reply.body(), StandardCharsets.UTF_8), is(problem));
    }

    @Test
    void return_502_for_problem_json_on_a_success_or_a_server_error() {
        for (int code : List.of(200, 500)) {
            backend.reply(new FixtureBackend.Reply(code, Map.of("Content-Type", "application/problem+json"),
                    "{}".getBytes(StandardCharsets.UTF_8), 0));

            assertThat(String.valueOf(code), status(request("GET", "/screen", null, null)), is(502));
        }
    }

    @Test
    void refuse_an_unknown_extension_route_or_method() {
        assertThat(status(new ExtensionProxyRequest("missing", "GET", "/screen", null, null, null, null, null)), is(404));
        assertThat(status(request("GET", "/admin", null, null)), is(404));
        assertThat(status(request("DELETE", "/screen", null, null)), is(405));
        assertThat(assertThrows(ExtensionProxyException.class, () -> service.call(alice,
                request("DELETE", "/namespaces/finos/services", null, null))).headers(), equalTo(Map.of("Allow", "GET, HEAD, POST")));
        assertThat(status(request("GET", "/%2e%2e/admin", null, null)), is(400));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_request_body_over_the_cap() {
        assertThat(status(request("POST", "/search", null, "x".repeat(1025))), is(413));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_a_header_value_with_a_line_break() {
        ExtensionProxyRequest request = new ExtensionProxyRequest("team-services", "GET", "/screen", null, null,
                "application/json\r\nX-Injected: 1", null, null);

        assertThat(status(request), is(400));
    }

    @Test
    void return_502_for_a_reply_over_the_cap() {
        backend.reply(FixtureBackend.Reply.json(200, "[" + "1,".repeat(600) + "1]"));

        assertThat(status(request("GET", "/screen", null, null)), is(502));
    }

    @Test
    void return_502_for_a_server_error_a_redirect_or_a_login_challenge() {
        for (int code : List.of(500, 503, 302, 401, 407)) {
            backend.reply(new FixtureBackend.Reply(code, Map.of("Content-Type", "application/json",
                    "Location", backend.url("/elsewhere").toString()), "{}".getBytes(StandardCharsets.UTF_8), 0));

            assertThat(String.valueOf(code), status(request("GET", "/screen", null, null)), is(502));
            assertThat(backend.received().pathAndQuery(), is("/base/screen"));
        }
    }

    @Test
    void return_502_for_a_content_type_that_is_not_allowed() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/html"),
                "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8), 0));
        assertThat(status(request("GET", "/screen", null, null)), is(502));

        backend.reply(new FixtureBackend.Reply(200, Map.of(), "untyped".getBytes(StandardCharsets.UTF_8), 0));
        assertThat(status(request("GET", "/screen", null, null)), is(502));
    }

    @Test
    void return_504_when_the_backend_is_slow() {
        register(backend.url("/base"), limits(1024, 1024, Duration.ofMillis(300)));
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json"),
                "{}".getBytes(StandardCharsets.UTF_8), 2000));

        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("GET", "/screen", null, null)));

        assertThat(e.status(), is(504));
        assertThat(e.getMessage(), is("The extension did not reply in time"));
    }

    @Test
    void return_502_when_the_backend_is_down() {
        register(URI.create("http://localhost:" + FixtureBackend.freePort()), limits(1024, 1024, Duration.ofSeconds(5)));

        ExtensionProxyException e = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("GET", "/screen", null, null)));

        assertThat(e.status(), is(502));
        assertThat(e.getMessage(), is("The extension failed"));
    }

    @Test
    void name_the_auth_mode() {
        SmallRyeConfig authOn = new SmallRyeConfigBuilder()
                .withSources(new PropertiesConfigSource(Map.of("calm.auth.enabled", "true"), "test", 100)).build();
        SmallRyeConfig authOff = new SmallRyeConfigBuilder().build();

        assertThat(ExtensionProxyService.authMode(authOff, false), is("none"));
        assertThat(ExtensionProxyService.authMode(authOn, false), is("oidc"));
        assertThat(ExtensionProxyService.authMode(authOn, true), is("proxy"));
    }

    @Test
    void check_the_scope_with_the_namespace_from_the_path_only() {
        when(permissions.canRead(any(), any())).thenReturn(false);
        when(permissions.canRead(alice, "finos.payments")).thenReturn(true);

        service.call(alice, request("GET", "/namespaces/finos.payments/services", "namespace=finos.other", null));
        assertThat(status(request("GET", "/namespaces/finos.other/services", "namespace=finos.payments", null)), is(403));

        verify(permissions).canRead(alice, "finos.other");
    }

    @Test
    void check_access_without_calling_the_backend() {
        service.checkAccess(alice, request("POST", "/namespaces/finos/services", null, "{}"));
        when(permissions.canWrite(any(), any())).thenReturn(false);

        ExtensionProxyException denied = assertThrows(ExtensionProxyException.class,
                () -> service.checkAccess(alice, request("POST", "/namespaces/finos/services", null, "{}")));

        assertThat(denied.status(), is(403));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.checkAccess(alice, request("GET", "/missing", null, null))).status(), is(404));
        assertThat(backend.received(), nullValue());
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(AuditOutcome.DENIED));
    }

    @Test
    void refuse_a_namespace_that_is_not_valid_before_any_check() {
        assertThat(status(request("GET", "/namespaces/a%20b/services", null, null)), is(400));
        verify(permissions, never()).canRead(any(), any());
    }

    @Test
    void return_401_for_an_anonymous_or_missing_caller() {
        SecurityIdentity anonymous = mock(SecurityIdentity.class);
        when(anonymous.isAnonymous()).thenReturn(true);

        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.call(anonymous, request("GET", "/screen", null, null))).status(), is(401));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.call(null, request("GET", "/screen", null, null))).status(), is(401));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void check_global_admin_and_domain_scopes_with_the_permission_checker() {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new Route("admin", "GET", "/admin", "global_admin", false),
                        new Route("domain", "PUT", "/domains/{domain}/services", "domain_write", false),
                        new Route("domain-admin", "DELETE", "/domains/{domain}/services", "domain_admin", false),
                        new Route("domain-read", "GET", "/domains/{domain}/services", "domain_read", false),
                        new Route("ns-admin", "DELETE", "/namespaces/{namespace}/services", "admin", false)),
                null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));

        assertThat(status(request("GET", "/admin", null, null)), is(403));
        assertThat(status(request("PUT", "/domains/payments/services", null, null)), is(403));
        assertThat(status(request("DELETE", "/domains/payments/services", null, null)), is(403));
        assertThat(status(request("GET", "/domains/payments/services", null, null)), is(403));
        assertThat(status(request("DELETE", "/namespaces/finos/services", null, null)), is(403));
        verify(permissions).hasGlobalAdmin(alice);
        verify(permissions).canWriteByDomain(alice, "payments");
        verify(permissions).allowDomainAdmin(alice, "payments");
        verify(permissions).canReadByDomain(alice, "payments");
        verify(permissions).allowNamespaceAdmin(alice, "finos");

        when(permissions.hasGlobalAdmin(alice)).thenReturn(true);
        assertThat(service.call(alice, request("GET", "/admin", null, null)).status(), is(200));
    }

    @Test
    void allow_only_get_and_read_only_routes_on_a_read_only_hub() {
        when(registry.isReadOnly()).thenReturn(true);

        ExtensionProxyException refused = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("POST", "/namespaces/finos/services", null, "{}")));
        assertThat(refused.status(), is(405));
        assertThat(refused.headers(), equalTo(Map.of("Allow", "GET, HEAD")));
        assertThat(service.call(alice, request("POST", "/search", null, "{}")).status(), is(200));
        assertThat(service.call(alice, request("GET", "/screen", null, null)).status(), is(200));
    }

    @Test
    void list_only_the_accepted_methods_for_a_method_mismatch_on_a_read_only_hub() {
        when(registry.isReadOnly()).thenReturn(true);

        ExtensionProxyException mismatch = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("DELETE", "/namespaces/finos/services", null, null)));
        assertThat(mismatch.status(), is(405));
        assertThat(mismatch.getMessage(), is("The extension route does not allow this method"));
        assertThat(mismatch.headers(), equalTo(Map.of("Allow", "GET, HEAD")));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("DELETE", "/search", null, null))).headers(),
                equalTo(Map.of("Allow", "POST")));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void audit_a_write_route_with_the_extension_route_and_jti() throws IOException {
        service.call(alice, request("POST", "/namespaces/finos/services", null, "{\"name\":\"x\"}"));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        AuditLogEntry entry = captor.getValue();
        assertThat(entry.getEntityType(), is(AuditEntityType.EXTENSION));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
        assertThat(entry.getOutcome(), is(AuditOutcome.SUCCESS));
        assertThat(entry.getActor(), is("alice"));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getEntityId(), is("team-services"));
        assertThat(entry.getRoute(), is("add-service"));
        assertThat(entry.getJti(), is(claims(backend.received().header("X-Calm-Hub-Identity")).get("jti").asText()));
    }

    @Test
    void audit_a_denied_write_and_not_a_read_only_route() {
        when(permissions.canWrite(any(), any())).thenReturn(false);

        assertThat(status(request("POST", "/namespaces/finos/services", null, "{}")), is(403));
        service.call(alice, request("POST", "/search", null, "{}"));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(AuditOutcome.DENIED));
        assertThat(captor.getValue().getJti(), nullValue());
        assertThat(captor.getValue().getRoute(), is("add-service"));
    }

    @Test
    void audit_an_uncertain_write_when_the_backend_failed() {
        backend.reply(FixtureBackend.Reply.json(500, "{}"));

        assertThat(status(request("POST", "/namespaces/finos/services", null, "{}")), is(502));
        assert_audit(AuditOutcome.UNKNOWN, "add-service");
    }

    @Test
    void audit_a_non_read_only_get() {
        service.call(alice, request("GET", "/screen", null, null));
        assert_audit(AuditOutcome.SUCCESS, "screen");
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 404, 403})
    void audit_backend_client_errors(int status) {
        backend.reply(FixtureBackend.Reply.json(status, "{}"));
        assertThat(service.call(alice, request("POST", "/namespaces/finos/services", null, "{}")).status(), is(status));
        assert_audit(status == 403 ? AuditOutcome.DENIED : AuditOutcome.FAILURE, "add-service");
    }

    @Test
    void audit_an_uncertain_write_on_timeout() {
        register(backend.url("/base"), limits(1024, 1024, Duration.ofMillis(100)));
        backend.reply(new FixtureBackend.Reply(200, Map.of(), new byte[0], 500));
        assertThat(status(request("POST", "/namespaces/finos/services", null, "{}")), is(504));
        assert_audit(AuditOutcome.UNKNOWN, "add-service");
    }

    @Test
    void audit_an_uncertain_write_on_connection_error() {
        register(URI.create("http://localhost:" + FixtureBackend.freePort()), limits(1024, 1024, Duration.ofSeconds(1)));
        assertThat(status(request("POST", "/namespaces/finos/services", null, "{}")), is(502));
        assert_audit(AuditOutcome.UNKNOWN, "add-service");
    }

    @Test
    void audit_an_uncertain_write_on_oversized_response() {
        backend.reply(FixtureBackend.Reply.json(200, "x".repeat(2048)));
        assertThat(status(request("POST", "/namespaces/finos/services", null, "{}")), is(502));
        assert_audit(AuditOutcome.UNKNOWN, "add-service");
    }

    @Test
    void audit_a_413_a_bad_header_and_a_bad_query_on_a_write_route_with_no_jti() {
        assertThat(status(request("POST", "/namespaces/finos/services", null, "x".repeat(1025))), is(413));
        assertThat(status(conditional("POST", "/namespaces/finos/services", "\"v1\"\r\nX-Injected: 1", null)), is(400));
        assertThat(status(request("POST", "/namespaces/finos/services", "q=%0a", "{}")), is(400));
        assertThat(status(request("POST", "/search", null, "x".repeat(1025))), is(413));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService, times(3)).record(captor.capture());
        for (AuditLogEntry entry : captor.getAllValues()) {
            assertThat(entry.getOutcome(), is(AuditOutcome.FAILURE));
            assertThat(entry.getRoute(), is("add-service"));
            assertThat(entry.getNamespace(), is("finos"));
            assertThat(entry.getJti(), nullValue());
        }
        assertThat(backend.received(), nullValue());
    }

    @Test
    void record_the_source_ip_in_each_audit_entry() {
        service.call(alice, withSourceIp("POST", "/namespaces/finos/services", "{}"));
        assertThat(status(withSourceIp("POST", "/namespaces/finos/services", null)), is(415));
        when(permissions.canWrite(any(), any())).thenReturn(false);
        assertThat(status(withSourceIp("POST", "/namespaces/finos/services", "{}")), is(403));

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService, times(3)).record(captor.capture());
        assertThat(captor.getAllValues().stream().map(AuditLogEntry::getSourceIp).toList(),
                equalTo(List.of("10.0.0.1", "10.0.0.1", "10.0.0.1")));
    }

    @Test
    void forward_the_conditional_headers() {
        service.call(alice, conditional("POST", "/namespaces/finos/services", "\"v1\"", "*"));

        assertThat(backend.received().header("If-Match"), is("\"v1\""));
        assertThat(backend.received().header("If-None-Match"), is("*"));

        backend.reset();
        service.call(alice, request("GET", "/screen", null, null));
        assertThat(backend.received().header("If-Match"), nullValue());
        assertThat(backend.received().header("If-None-Match"), nullValue());
    }

    @Test
    void refuse_a_conditional_header_with_a_line_break() {
        assertThat(status(conditional("GET", "/screen", null, "\"v1\"\r\nX-Injected: 1")), is(400));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void pass_on_a_304_with_its_etag() {
        backend.reply(new FixtureBackend.Reply(304, Map.of("ETag", "\"v1\""), new byte[0], 0));

        ExtensionProxyResponse reply = service.call(alice, conditional("GET", "/screen", null, "\"v1\""));

        assertThat(reply.status(), is(304));
        assertThat(reply.headers().get("ETag"), is("\"v1\""));
        assert_audit(AuditOutcome.SUCCESS, "screen");
    }

    @Test
    void pass_on_retry_after_and_vary_but_not_location() {
        backend.reply(new FixtureBackend.Reply(429, Map.of("Content-Type", "application/json", "Retry-After", "30",
                "Vary", "Accept-Language", "Location", "http://backend.internal/queue"),
                "{}".getBytes(StandardCharsets.UTF_8), 0));

        ExtensionProxyResponse reply = service.call(alice, request("GET", "/screen", null, null));

        assertThat(reply.status(), is(429));
        assertThat(reply.headers(), equalTo(Map.of("Content-Type", "application/json", "Retry-After", "30",
                "Vary", "Accept-Language", "Cache-Control", "private")));
    }

    @Test
    void refuse_a_call_over_the_concurrent_call_limit_with_503() throws Exception {
        register(backend.url("/base"), new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 1024, 1024, 1));
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "application/json"),
                "{}".getBytes(StandardCharsets.UTF_8), 1000));
        CompletableFuture<ExtensionProxyResponse> slow = CompletableFuture.supplyAsync(
                () -> service.call(alice, request("POST", "/search", null, "{}")));
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (backend.received() == null && System.nanoTime() < deadline) {
            Thread.sleep(10);
        }

        ExtensionProxyException busy = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("POST", "/namespaces/finos/services", null, "{}")));

        assertThat(busy.status(), is(503));
        assertThat(busy.headers(), equalTo(Map.of("Retry-After", "1")));
        assertThat(slow.get(5, TimeUnit.SECONDS).status(), is(200));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        assertThat(service.call(alice, request("POST", "/search", null, "{}")).status(), is(200));
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(AuditOutcome.FAILURE));
        assertThat(captor.getValue().getRoute(), is("add-service"));
        assertThat(captor.getValue().getJti(), nullValue());
    }

    @Test
    void release_the_call_slot_when_hub_refuses_the_call_after_taking_it() {
        register(backend.url("/base"), new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 1024, 1024, 1));

        assertThat(status(conditional("GET", "/screen", "\"v1\"\r\nX: 1", null)), is(400));
        backend.reply(FixtureBackend.Reply.json(500, "{}"));
        assertThat(status(request("GET", "/screen", null, null)), is(502));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        assertThat(service.call(alice, request("GET", "/screen", null, null)).status(), is(200));
    }

    private void assert_audit(AuditOutcome outcome, String route) {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        assertThat(captor.getValue().getOutcome(), is(outcome));
        assertThat(captor.getValue().getEntityId(), is("team-services"));
        assertThat(captor.getValue().getRoute(), is(route));
        assertThat(captor.getValue().getJti() != null, is(true));
        if ("screen".equals(route)) {
            assertThat(captor.getValue().getAction(), is(AuditAction.READ));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"/services/%61dmin", "/services/%61%64%6Din",
            "/%73ervices/admin", "/services/%2561dmin", "/services/admin%252Fsecret",
            "/services/bob%2Fteam", "/services/bob%2fteam"})
    void reject_encoded_literals_without_calling_the_backend(String path) {
        register_service_routes();
        assertThat(status(request("GET", path, null, null)), is(400));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void preserve_the_protected_literal_scope() {
        register_service_routes();
        assertThat(status(request("GET", "/services/admin", null, null)), is(403));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void forward_the_normalised_parameter_and_bind_it_in_the_assertion() throws IOException {
        register_service_routes();
        service.call(alice, request("GET", "/services/%62ob%3ateam", null, null));
        assertThat(backend.received().pathAndQuery(), is("/base/services/bob%3Ateam"));
        JsonNode assertion = claims(backend.received().header("X-Calm-Hub-Identity"));
        assertThat(assertion.get("route").asText(), is("service"));
        assertThat(assertion.get("htp").asText(), is("/services/bob%3Ateam"));
    }

    @Test
    void call_a_dedicated_route_only_from_its_own_endpoint() throws IOException {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                MANIFEST.routes(), null, new ExtensionManifest.Contributions(null, null, null, null, null,
                List.of(new ExtensionManifest.RouteContribution("services", "Services", "search")), null, null, null, null));
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));

        ExtensionProxyException generic = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, request("POST", "/search", null, "{}")));
        assertThat(generic.status(), is(404));
        assertThat(generic.getMessage(), is("Call this extension route through its CALM Hub endpoint"));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.checkAccess(alice, request("POST", "/search", null, "{}"))).status(), is(404));
        // A dedicated endpoint reaches only its own route.
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.callDedicated(alice, request("GET", "/screen", null, null), "search", null)).status(), is(404));
        assertThat(backend.received(), nullValue());

        assertThat(service.callDedicated(alice, request("POST", "/search", null, "{}"), "search", null).status(), is(200));
        assertThat(claims(backend.received().header("X-Calm-Hub-Identity")).get("route").asText(), is("search"));
    }

    private void register_service_routes() {
        ExtensionManifest manifest = new ExtensionManifest("team-services", "1.0.0", 0, "Team services", null, null,
                List.of(new Route("service", "GET", "/services/{service}", "authenticated", false),
                        new Route("admin", "GET", "/services/admin", "global_admin", false)), null, null);
        when(registry.find("team-services")).thenReturn(Optional.of(new RegisteredExtension(manifest, 0,
                Optional.of(backend.url("/base")), limits(1024, 1024, Duration.ofSeconds(5)))));
    }

    @Test
    void fail_the_capped_body_on_an_upstream_error_and_ignore_data_after_the_cap() {
        ExtensionProxyService.CappedBodySubscriber failed = new ExtensionProxyService.CappedBodySubscriber(4);
        failed.onError(new IOException("reset"));
        assertThat(failed.getBody().toCompletableFuture().isCompletedExceptionally(), is(true));

        ExtensionProxyService.CappedBodySubscriber capped = new ExtensionProxyService.CappedBodySubscriber(4);
        Flow.Subscription subscription = mock(Flow.Subscription.class);
        capped.onSubscribe(subscription);
        capped.onNext(List.of(ByteBuffer.wrap(new byte[5])));
        capped.onNext(List.of(ByteBuffer.wrap(new byte[1])));
        capped.onComplete();

        verify(subscription).cancel();
        assertThat(capped.getBody().toCompletableFuture().isCompletedExceptionally(), is(true));
    }

    private static final ExtensionManifest CHAT_MANIFEST = new ExtensionManifest("team-services", "1.0.0", 0,
            "Team services", null, null, List.of(
            new Route("screen", "GET", "/screen", "authenticated", false),
            new Route("ask", "POST", "/chat", "authenticated", true)),
            null, new ExtensionManifest.Contributions(null, null, null, null, null, null,
            List.of(new ExtensionManifest.RouteContribution("assistant", "Ask Atlas", "ask")), null, null, null));
    private static final String QUESTION = """
            {"conversationId":"c1","messageId":"m1","messages":[{"role":"user","content":"Which services?"}],"extra":1}""";

    @Test
    void stream_each_event_to_a_caller_that_accepts_an_event_stream_before_the_backend_ends() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream", List.of(
                "id: 1\nretry: 10\nevent: delta\ndata: {\"text\":\"Hel\"}\n\n",
                "data: lo\n\n"), gate));

        ExtensionProxyResponse reply = service.call(alice, eventStream("GET", "/screen"));
        StringBuffer written = new StringBuffer();
        CompletableFuture<Void> writing = CompletableFuture.runAsync(() -> reply.stream().writeTo(collect(written)));

        await(() -> written.toString().contains("Hel"));
        assertThat(written.toString(), is("event: delta\ndata: {\"text\":\"Hel\"}\n\n"));
        gate.countDown();
        writing.get(5, TimeUnit.SECONDS);
        assertThat(written.toString(), is("event: delta\ndata: {\"text\":\"Hel\"}\n\ndata: lo\n\n"));
        assertThat(reply.status(), is(200));
        assertThat(reply.headers(), equalTo(Map.of("Content-Type", "text/event-stream; charset=utf-8",
                "Cache-Control", "private, no-store", "X-Accel-Buffering", "no")));
    }

    @Test
    void buffer_an_event_stream_for_a_caller_that_does_not_accept_one() {
        backend.reply(new FixtureBackend.Reply(200, Map.of("Content-Type", "text/event-stream"),
                "data: whole\n\n".getBytes(StandardCharsets.UTF_8), 0));

        ExtensionProxyResponse reply = service.call(alice, request("GET", "/screen", null, null));

        assertThat(reply.stream(), nullValue());
        assertThat(new String(reply.body(), StandardCharsets.UTF_8), is("data: whole\n\n"));
    }

    @Test
    void buffer_a_reply_that_is_not_an_event_stream_for_a_caller_that_accepts_one() {
        backend.reply(FixtureBackend.Reply.json(200, "{\"a\":1}"));

        ExtensionProxyResponse reply = service.call(alice, eventStream("GET", "/screen"));

        assertThat(reply.stream(), nullValue());
        assertThat(new String(reply.body(), StandardCharsets.UTF_8), is("{\"a\":1}"));
    }

    @Test
    void refuse_more_streams_than_the_limit_and_free_the_slot_when_a_stream_closes() throws Exception {
        register(backend.url("/base"), new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 1024, 1024, 32,
                1, Duration.ofSeconds(5), Duration.ofSeconds(30)));
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream", List.of("data: 1\n\n", "data: 2\n\n"), gate));
        ExtensionProxyResponse open = service.call(alice, eventStream("GET", "/screen"));

        ExtensionProxyException busy = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, eventStream("GET", "/screen")));
        assertThat(busy.status(), is(503));
        assertThat(busy.headers(), equalTo(Map.of("Retry-After", "1")));
        // A buffered call does not need a stream slot.
        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        assertThat(service.call(alice, request("GET", "/screen", null, null)).status(), is(200));

        open.stream().close();
        gate.countDown();
        backend.stream(FixtureBackend.Stream.events("data: 3\n\n"));
        ExtensionProxyResponse next = service.call(alice, eventStream("GET", "/screen"));
        assertThat(next.stream() != null, is(true));
        next.stream().close();
    }

    @Test
    void free_the_stream_slot_when_the_backend_does_not_send_an_event_stream() {
        register(backend.url("/base"), new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 1024, 1024, 32,
                1, Duration.ofSeconds(5), Duration.ofSeconds(30)));
        backend.reply(FixtureBackend.Reply.json(500, "{}"));
        assertThat(status(eventStream("GET", "/screen")), is(502));
        backend.reply(FixtureBackend.Reply.json(200, "{}"));
        assertThat(service.call(alice, eventStream("GET", "/screen")).status(), is(200));
        backend.stream(FixtureBackend.Stream.events("data: 1\n\n"));
        ExtensionProxyResponse stream = service.call(alice, eventStream("GET", "/screen"));
        assertThat(stream.stream() != null, is(true));
        stream.stream().close();
    }

    @Test
    void close_the_backend_connection_when_the_caller_closes_the_stream() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        List<String> parts = new java.util.ArrayList<>(List.of("data: first\n\n"));
        for (int i = 0; i < 200; i++) {
            parts.add("data: " + "x".repeat(1000) + "\n\n");
        }
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream", parts, gate));
        ExtensionProxyResponse reply = service.call(alice, eventStream("GET", "/screen"));

        reply.stream().close();
        gate.countDown();

        await(backend::streamBroken);
    }

    @Test
    void refuse_a_chat_route_on_the_generic_proxy_and_mcp_path_without_calling_the_backend() {
        registerChat(limits(4096, 4096, Duration.ofSeconds(5)));

        ExtensionProxyException refused = assertThrows(ExtensionProxyException.class,
                () -> service.call(alice, eventStream("POST", "/chat")));
        assertThat(refused.status(), is(404));
        assertThat(refused.getMessage(), is("Call this extension route through its CALM Hub endpoint"));
        assertThat(assertThrows(ExtensionProxyException.class,
                () -> service.checkAccess(alice, request("POST", "/chat", null, "{}"))).status(), is(404));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void send_the_chat_body_that_hub_built_and_pass_back_only_the_citations_the_caller_can_open() throws Exception {
        registerChat(limits(4096, 4096, Duration.ofSeconds(5)));
        when(permissions.canRead(alice, "finos")).thenReturn(true);
        when(permissions.canRead(alice, "secret")).thenReturn(false);
        backend.stream(FixtureBackend.Stream.events(
                "event: delta\ndata: {\"text\":\"See \"}\n\n",
                "event: citation\ndata: {\"label\":\"Open\",\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\","
                        + "\"id\":\"1\",\"version\":\"1.0.0\"}}\n\n"
                        + "event: citation\ndata: {\"label\":\"Hidden\",\"hub\":{\"namespace\":\"secret\",\"type\":"
                        + "\"architectures\",\"id\":\"1\",\"version\":\"1.0.0\"}}\n\n"
                        + "event: done\ndata: {}\n\n"));

        ExtensionProxyResponse reply = service.chat(alice, "team-services", "assistant", "application/json", "en-GB",
                new ByteArrayInputStream(QUESTION.getBytes(StandardCharsets.UTF_8)));
        StringBuffer written = new StringBuffer();
        reply.stream().writeTo(collect(written));

        FixtureBackend.Received received = backend.received();
        assertThat(received.method(), is("POST"));
        assertThat(received.pathAndQuery(), is("/base/chat"));
        assertThat(received.header("Accept"), is("text/event-stream"));
        assertThat(received.header("Accept-Language"), is("en-GB"));
        assertThat(MAPPER.readTree(received.body()), equalTo(MAPPER.readTree("""
                {"hubApi":0,"conversationId":"c1","messageId":"m1","messages":[{"role":"user","content":"Which services?"}]}""")));
        JsonNode claims = claims(received.header("X-Calm-Hub-Identity"));
        assertThat(claims.get("route").asText(), is("ask"));
        assertThat(claims.get("htm").asText(), is("POST"));
        assertThat(written.toString(), is("event: delta\ndata: {\"text\":\"See \"}\n\n"
                + "event: citation\ndata: {\"label\":\"Open\",\"hub\":{\"namespace\":\"finos\",\"type\":\"architectures\","
                + "\"id\":\"1\",\"version\":\"1.0.0\"}}\n\nevent: done\ndata: {}\n\n"));
        verify(auditService, never()).record(any());
    }

    @Test
    void end_a_chat_reply_after_its_terminal_event_and_free_the_stream_slot_while_the_backend_still_sends() throws Exception {
        registerChat(new ExtensionLimits(Duration.ofSeconds(2), Duration.ofSeconds(5), 4096, 4096, 32, 1,
                Duration.ofSeconds(5), Duration.ofSeconds(30)));
        CountDownLatch gate = new CountDownLatch(1);
        List<String> parts = new java.util.ArrayList<>(List.of("event: error\ndata: {\"message\":\"No model\"}\n\n"));
        for (int i = 0; i < 200; i++) {
            parts.add("event: delta\ndata: {\"text\":\"" + "x".repeat(1000) + "\"}\n\n");
        }
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream", parts, gate));
        StringBuffer written = new StringBuffer();

        chat(QUESTION).stream().writeTo(collect(written));
        gate.countDown();

        assertThat(written.toString(), is("event: error\ndata: {\"message\":\"No model\"}\n\n"));
        await(backend::streamBroken);
        backend.stream(FixtureBackend.Stream.events("event: done\ndata: {}\n\n"));
        assertThat(chat(QUESTION).status(), is(200));
    }

    @Test
    void keep_a_generic_event_stream_open_after_an_event_named_done() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(new FixtureBackend.Stream(200, "text/event-stream",
                List.of("event: done\ndata: {}\n\n", "data: after\n\n"), gate));
        ExtensionProxyResponse reply = service.call(alice, eventStream("GET", "/screen"));
        StringBuffer written = new StringBuffer();
        CompletableFuture<Void> writing = CompletableFuture.runAsync(() -> reply.stream().writeTo(collect(written)));

        await(() -> written.toString().contains("done"));
        gate.countDown();
        writing.get(5, TimeUnit.SECONDS);
        assertThat(written.toString(), is("event: done\ndata: {}\n\ndata: after\n\n"));
    }

    @Test
    void return_502_when_a_chat_route_replies_with_success_but_no_event_stream() {
        registerChat(limits(4096, 4096, Duration.ofSeconds(5)));
        backend.reply(FixtureBackend.Reply.json(200, "{\"answer\":\"buffered\"}"));

        ExtensionProxyException failed = assertThrows(ExtensionProxyException.class, () -> chat(QUESTION));

        assertThat(failed.status(), is(502));
    }

    @Test
    void pass_on_a_json_client_error_from_a_chat_route() {
        registerChat(limits(4096, 4096, Duration.ofSeconds(5)));
        backend.reply(FixtureBackend.Reply.json(429, "{\"message\":\"Slow down\"}"));

        ExtensionProxyResponse reply = chat(QUESTION);

        assertThat(reply.status(), is(429));
        assertThat(reply.stream(), nullValue());
    }

    @Test
    void refuse_a_chat_message_that_is_not_valid_or_too_large_before_calling_the_backend() {
        registerChat(limits(200, 4096, Duration.ofSeconds(5)));

        assertThat(assertThrows(ExtensionProxyException.class, () -> chat("{\"messages\":[]}")).status(), is(400));
        String longQuestion = QUESTION.replace("Which services?", "x".repeat(180));
        assertThat(assertThrows(ExtensionProxyException.class, () -> chat(longQuestion)).status(), is(413));
        assertThat(backend.received(), nullValue());
    }

    @Test
    void refuse_an_unknown_chat_entry_or_extension_with_404() {
        registerChat(limits(4096, 4096, Duration.ofSeconds(5)));

        assertThat(assertThrows(ExtensionProxyException.class, () -> service.chat(alice, "team-services", "other",
                "application/json", null, new ByteArrayInputStream(new byte[0]))).status(), is(404));
        assertThat(assertThrows(ExtensionProxyException.class, () -> service.chat(alice, "missing", "assistant",
                "application/json", null, new ByteArrayInputStream(new byte[0]))).status(), is(404));
        register(backend.url("/base"), limits(4096, 4096, Duration.ofSeconds(5)));
        assertThat(assertThrows(ExtensionProxyException.class, () -> chat(QUESTION)).status(), is(404));
    }

    private ExtensionProxyResponse chat(String body) {
        return service.chat(alice, "team-services", "assistant", "application/json", null,
                new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private void registerChat(ExtensionLimits limits) {
        when(registry.find("team-services")).thenReturn(Optional.of(
                new RegisteredExtension(CHAT_MANIFEST, 0, Optional.of(backend.url("/base")), limits)));
    }

    private static ExtensionProxyRequest eventStream(String method, String path) {
        boolean post = "POST".equals(method);
        return new ExtensionProxyRequest("team-services", method, path, null, post ? "application/json" : null,
                "text/event-stream", null, post ? new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)) : null);
    }

    private static OutputStream collect(StringBuffer written) {
        return new OutputStream() {
            @Override
            public void write(int b) {
                write(new byte[] {(byte) b}, 0, 1);
            }

            @Override
            public void write(byte[] bytes, int offset, int length) {
                written.append(new String(bytes, offset, length, StandardCharsets.UTF_8));
            }
        };
    }

    private static void await(java.util.function.BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() > deadline) {
                throw new AssertionError("The condition did not hold within 5 seconds");
            }
            Thread.sleep(10);
        }
    }

    static SecurityIdentity identity(String name) {
        SecurityIdentity identity = mock(SecurityIdentity.class);
        Principal principal = mock(Principal.class);
        when(identity.getPrincipal()).thenReturn(principal);
        when(principal.getName()).thenReturn(name);
        return identity;
    }

    private static ExtensionLimits limits(int maxRequestBytes, int maxResponseBytes, Duration requestTimeout) {
        return new ExtensionLimits(Duration.ofSeconds(2), requestTimeout, maxRequestBytes, maxResponseBytes, 32);
    }

    private void register(URI backendUrl, ExtensionLimits limits) {
        RegisteredExtension extension = new RegisteredExtension(MANIFEST, 0, Optional.of(backendUrl), limits);
        when(registry.find("team-services")).thenReturn(Optional.of(extension));
    }

    private int status(ExtensionProxyRequest request) {
        return assertThrows(ExtensionProxyException.class, () -> service.call(alice, request)).status();
    }

    private static ExtensionProxyRequest request(String method, String path, String query, String body) {
        return new ExtensionProxyRequest("team-services", method, path, query,
                body == null ? null : "application/json", "application/json", "en-GB",
                body == null ? null : new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private static ExtensionProxyRequest conditional(String method, String path, String ifMatch, String ifNoneMatch) {
        boolean post = "POST".equals(method);
        return new ExtensionProxyRequest("team-services", method, path, null, post ? "application/json" : null,
                "application/json", null, ifMatch, ifNoneMatch, null,
                post ? new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)) : null);
    }

    private static ExtensionProxyRequest withSourceIp(String method, String path, String body) {
        return new ExtensionProxyRequest("team-services", method, path, null, body == null ? null : "application/json",
                null, null, null, null, "10.0.0.1",
                body == null ? null : new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private static JsonNode claims(String token) throws IOException {
        return MAPPER.readTree(Base64.getUrlDecoder().decode(token.split("\\.")[1]));
    }
}
