package org.finos.calm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.sameInstance;

class TestOidcPluginAuthClientShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private OidcPluginAuthClient client;
    private HttpServer server;
    private int serverPort;
    private final AtomicInteger discoveryHits = new AtomicInteger();

    @BeforeEach
    void setup() throws Exception {
        client = new OidcPluginAuthClient();
        setField("connectTimeoutSeconds", 5);
        setField("requestTimeoutSeconds", 5);
        invokeInit();

        // Start a local HTTP server for testing
        server = HttpServer.create(new InetSocketAddress(0), 0);
        serverPort = server.getAddress().getPort();
        server.start();
    }

    @AfterEach
    void teardown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private void setField(String name, Object value) throws Exception {
        Field field = OidcPluginAuthClient.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(client, value);
    }

    private void invokeInit() throws Exception {
        Method init = OidcPluginAuthClient.class.getDeclaredMethod("init");
        init.setAccessible(true);
        init.invoke(client);
    }

    private void serveDiscoveryDocument(ObjectNode discoveryDoc) {
        server.createContext("/.well-known/openid-configuration", exchange -> {
            discoveryHits.incrementAndGet();
            byte[] body = MAPPER.writeValueAsBytes(discoveryDoc);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
    }

    // --- discoverEndpoints tests ---

    @Test
    void return_endpoints_from_valid_discovery_document() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");
        discoveryDoc.put("token_endpoint", "https://idp.example.com/token");
        discoveryDoc.put("issuer", "https://idp.example.com");
        serveDiscoveryDocument(discoveryDoc);

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(notNullValue()));
        assertThat(result.authorizationEndpoint(), equalTo("https://idp.example.com/authorize"));
        assertThat(result.tokenEndpoint(), equalTo("https://idp.example.com/token"));
    }

    @Test
    void return_endpoints_when_issuer_url_has_trailing_slash() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");
        discoveryDoc.put("token_endpoint", "https://idp.example.com/token");
        serveDiscoveryDocument(discoveryDoc);

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort + "/");

        assertThat(result, is(notNullValue()));
        assertThat(result.authorizationEndpoint(), equalTo("https://idp.example.com/authorize"));
    }

    @Test
    void return_null_when_discovery_returns_non_200() {
        server.createContext("/.well-known/openid-configuration", exchange -> {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(nullValue()));
    }

    @Test
    void return_null_when_discovery_document_missing_authorization_endpoint() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("token_endpoint", "https://idp.example.com/token");
        serveDiscoveryDocument(discoveryDoc);

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(nullValue()));
    }

    @Test
    void return_null_when_discovery_document_missing_token_endpoint() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");
        serveDiscoveryDocument(discoveryDoc);

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(nullValue()));
    }

    @Test
    void return_null_when_discovery_url_is_unreachable() {
        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:1");

        assertThat(result, is(nullValue()));
    }

    @Test
    void return_null_when_discovery_returns_invalid_json() {
        server.createContext("/.well-known/openid-configuration", exchange -> {
            byte[] body = "not-json".getBytes();
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(nullValue()));
    }

    // --- discovery caching ---

    @Test
    void cache_the_discovery_document_across_calls_for_the_same_issuer() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");
        discoveryDoc.put("token_endpoint", "https://idp.example.com/token");
        serveDiscoveryDocument(discoveryDoc);
        String issuer = "http://localhost:" + serverPort;

        OidcPluginAuthClient.OidcEndpoints first = client.discoverEndpoints(issuer);
        server.removeContext("/.well-known/openid-configuration");
        OidcPluginAuthClient.OidcEndpoints second = client.discoverEndpoints(issuer);

        assertThat(discoveryHits.get(), equalTo(1));
        assertThat(second, sameInstance(first));
    }

    @Test
    void refetch_discovery_when_the_issuer_changes() throws Exception {
        ObjectNode discoveryDocA = MAPPER.createObjectNode();
        discoveryDocA.put("authorization_endpoint", "https://a.example.com/authorize");
        discoveryDocA.put("token_endpoint", "https://a.example.com/token");
        serveDiscoveryDocument(discoveryDocA);
        String issuerA = "http://localhost:" + serverPort;

        client.discoverEndpoints(issuerA);

        HttpServer serverB = null;
        try {
            serverB = HttpServer.create(new InetSocketAddress(0), 0);
            int portB = serverB.getAddress().getPort();
            ObjectNode discoveryDocB = MAPPER.createObjectNode();
            discoveryDocB.put("authorization_endpoint", "https://b.example.com/authorize");
            discoveryDocB.put("token_endpoint", "https://b.example.com/token");
            byte[] body = MAPPER.writeValueAsBytes(discoveryDocB);
            serverB.createContext("/.well-known/openid-configuration", exchange -> {
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            serverB.start();

            OidcPluginAuthClient.OidcEndpoints result = client.discoverEndpoints("http://localhost:" + portB);

            assertThat(result.authorizationEndpoint(), equalTo("https://b.example.com/authorize"));
        } finally {
            if (serverB != null) {
                serverB.stop(0);
            }
        }
    }
}
