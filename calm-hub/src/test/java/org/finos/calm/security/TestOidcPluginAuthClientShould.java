package org.finos.calm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.net.InetSocketAddress;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

class TestOidcPluginAuthClientShould {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private OidcPluginAuthClient client;
    private HttpServer server;
    private int serverPort;

    @BeforeEach
    void setup() throws Exception {
        client = new OidcPluginAuthClient();
        setField("connectTimeoutSeconds", 5);
        setField("requestTimeoutSeconds", 5);

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

    // --- discoverEndpoints tests ---

    @Test
    void return_endpoints_from_valid_discovery_document() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");
        discoveryDoc.put("token_endpoint", "https://idp.example.com/token");
        discoveryDoc.put("issuer", "https://idp.example.com");

        server.createContext("/.well-known/openid-configuration", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(discoveryDoc);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

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

        server.createContext("/.well-known/openid-configuration", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(discoveryDoc);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

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

        server.createContext("/.well-known/openid-configuration", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(discoveryDoc);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        OidcPluginAuthClient.OidcEndpoints result =
                client.discoverEndpoints("http://localhost:" + serverPort);

        assertThat(result, is(nullValue()));
    }

    @Test
    void return_null_when_discovery_document_missing_token_endpoint() {
        ObjectNode discoveryDoc = MAPPER.createObjectNode();
        discoveryDoc.put("authorization_endpoint", "https://idp.example.com/authorize");

        server.createContext("/.well-known/openid-configuration", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(discoveryDoc);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

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

    // --- exchangeCode tests ---

    @Test
    void return_access_token_on_successful_exchange() {
        ObjectNode tokenResponse = MAPPER.createObjectNode();
        tokenResponse.put("access_token", "eyJhbGciOi...");
        tokenResponse.put("id_token", "id-token-value");
        tokenResponse.put("token_type", "Bearer");

        server.createContext("/token", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(tokenResponse);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        String tokenEndpoint = "http://localhost:" + serverPort + "/token";
        OidcPluginAuthClient.TokenResponse result =
                client.exchangeCode(tokenEndpoint, "client-id", "client-secret", "auth-code", "http://localhost:8080/callback", "test-verifier");

        assertThat(result, is(notNullValue()));
        assertThat(result.accessToken(), equalTo("eyJhbGciOi..."));
        assertThat(result.idToken(), equalTo("id-token-value"));
        assertThat(result.error(), is(nullValue()));
    }

    @Test
    void return_error_when_token_endpoint_returns_non_200() {
        server.createContext("/token", exchange -> {
            exchange.sendResponseHeaders(400, -1);
            exchange.close();
        });

        String tokenEndpoint = "http://localhost:" + serverPort + "/token";
        OidcPluginAuthClient.TokenResponse result =
                client.exchangeCode(tokenEndpoint, "client-id", "client-secret", "bad-code", "http://localhost:8080/callback", "test-verifier");

        assertThat(result.accessToken(), is(nullValue()));
        assertThat(result.error(), containsString("Token exchange failed with status 400"));
    }

    @Test
    void return_error_when_response_missing_access_token() {
        ObjectNode tokenResponse = MAPPER.createObjectNode();
        tokenResponse.put("id_token", "id-token-value");

        server.createContext("/token", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(tokenResponse);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        String tokenEndpoint = "http://localhost:" + serverPort + "/token";
        OidcPluginAuthClient.TokenResponse result =
                client.exchangeCode(tokenEndpoint, "client-id", "client-secret", "auth-code", "http://localhost:8080/callback", "test-verifier");

        assertThat(result.accessToken(), is(nullValue()));
        assertThat(result.error(), containsString("No access token in response"));
    }

    @Test
    void return_error_when_token_endpoint_is_unreachable() {
        OidcPluginAuthClient.TokenResponse result =
                client.exchangeCode("http://localhost:1/token", "client-id", "client-secret", "auth-code", "http://localhost:8080/callback", "test-verifier");

        assertThat(result.accessToken(), is(nullValue()));
        assertThat(result.error(), containsString("Token exchange failed:"));
    }

    @Test
    void return_access_token_when_id_token_is_absent() {
        ObjectNode tokenResponse = MAPPER.createObjectNode();
        tokenResponse.put("access_token", "access-only");
        tokenResponse.put("token_type", "Bearer");

        server.createContext("/token", exchange -> {
            byte[] body = MAPPER.writeValueAsBytes(tokenResponse);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        String tokenEndpoint = "http://localhost:" + serverPort + "/token";
        OidcPluginAuthClient.TokenResponse result =
                client.exchangeCode(tokenEndpoint, "client-id", "client-secret", "auth-code", "http://localhost:8080/callback", "test-verifier");

        assertThat(result.accessToken(), equalTo("access-only"));
        assertThat(result.idToken(), is(nullValue()));
        assertThat(result.error(), is(nullValue()));
    }
}
