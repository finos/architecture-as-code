package integration;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;
import java.util.Set;

@QuarkusTestResource(EndToEndResource.class)
public class IntegrationTestOidcProfile implements QuarkusTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of();
    }

    @Override
    public String getConfigProfile() {
        return "oidc";
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        // application-oidc.properties' quarkus.oidc.* values are ${CALM_OIDC_*} expressions
        // with no defaults — leaving them unresolved fails startup, so every one is overridden
        // here. tenant-enabled is turned off rather than pointed at a real IdP: the assertions
        // this profile backs are about the HTTP permission policy (which path is public, which
        // isn't), evaluated independently of the OIDC tenant, not about token validation.
        return Map.of(
                "quarkus.oidc.tenant-enabled", "false",
                "quarkus.oidc.auth-server-url", "https://example.invalid/oidc-test-issuer",
                "quarkus.oidc.client-id", "oidc-profile-integration-test",
                "quarkus.oidc.token.audience", "oidc-profile-integration-test",
                "quarkus.oidc.token.issuer", "https://example.invalid/oidc-test-issuer"
        );
    }
}
