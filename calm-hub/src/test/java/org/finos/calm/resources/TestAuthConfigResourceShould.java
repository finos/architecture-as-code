package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;

class TestAuthConfigResourceShould {

    private AuthConfigResource resource;

    @BeforeEach
    void setup() {
        resource = new AuthConfigResource();
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_disabled_config_when_oidc_off() {
        resource.oidcTenantEnabled = false;
        resource.databaseMode = "mongo";
        resource.oidcProvider = Optional.empty();
        resource.oidcAuthority = Optional.empty();
        resource.oidcClientId = Optional.empty();
        resource.oidcScopes = Optional.empty();

        Response response = resource.getAuthConfig();

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        Map<String, Object> oidc = (Map<String, Object>) body.get("oidc");
        assertThat(oidc.get("enabled"), equalTo(false));
        assertThat(body.get("databaseMode"), equalTo("mongo"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_full_config_for_entra_id_with_github_mode() {
        resource.oidcTenantEnabled = true;
        resource.databaseMode = "github";
        resource.oidcProvider = Optional.of("entra-id");
        resource.oidcAuthority = Optional.of("https://login.microsoftonline.com/tenant-id/v2.0");
        resource.oidcClientId = Optional.of("client-123");
        resource.oidcScopes = Optional.of("openid profile email");

        Response response = resource.getAuthConfig();

        assertThat(response.getStatus(), equalTo(200));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();

        Map<String, Object> oidc = (Map<String, Object>) body.get("oidc");
        assertThat(oidc.get("enabled"), equalTo(true));
        assertThat(oidc.get("provider"), equalTo("entra-id"));
        assertThat(oidc.get("authority"), equalTo("https://login.microsoftonline.com/tenant-id/v2.0"));
        assertThat(oidc.get("clientId"), equalTo("client-123"));
        assertThat(oidc.get("redirectUri"), equalTo("/"));

        assertThat(body.get("databaseMode"), equalTo("github"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_oidc_config_for_mongo_mode() {
        resource.oidcTenantEnabled = true;
        resource.databaseMode = "mongo";
        resource.oidcProvider = Optional.of("keycloak");
        resource.oidcAuthority = Optional.of("https://keycloak.example.com/realms/calm");
        resource.oidcClientId = Optional.of("calm-hub-spa");
        resource.oidcScopes = Optional.of("openid profile email");

        Response response = resource.getAuthConfig();

        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        Map<String, Object> oidc = (Map<String, Object>) body.get("oidc");
        assertThat(oidc.get("enabled"), equalTo(true));
        assertThat(oidc.get("provider"), equalTo("keycloak"));
        assertThat(body.get("databaseMode"), equalTo("mongo"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void not_include_oidc_details_when_disabled() {
        resource.oidcTenantEnabled = false;
        resource.databaseMode = "standalone";
        resource.oidcProvider = Optional.of("entra-id");
        resource.oidcAuthority = Optional.of("https://login.microsoftonline.com/tenant/v2.0");
        resource.oidcClientId = Optional.of("client-123");
        resource.oidcScopes = Optional.of("openid profile email");

        Response response = resource.getAuthConfig();

        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        Map<String, Object> oidc = (Map<String, Object>) body.get("oidc");
        assertThat(oidc.get("enabled"), equalTo(false));
        assertThat(oidc.containsKey("provider"), is(false));
        assertThat(oidc.containsKey("authority"), is(false));
    }

    @Test
    void always_return_200() {
        resource.oidcTenantEnabled = false;
        resource.databaseMode = "mongo";
        resource.oidcProvider = Optional.empty();
        resource.oidcAuthority = Optional.empty();
        resource.oidcClientId = Optional.empty();
        resource.oidcScopes = Optional.empty();

        Response response = resource.getAuthConfig();

        assertThat(response.getStatus(), equalTo(200));
    }
}
