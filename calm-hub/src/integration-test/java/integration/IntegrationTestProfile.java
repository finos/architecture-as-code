package integration;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;
import java.util.Set;

@QuarkusTestResource(EndToEndResource.class)
public class IntegrationTestProfile implements QuarkusTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        // Optionally, return specific classes you want enabled only for this profile
        return Set.of();
    }

    @Override
    public String getConfigProfile() {
        // Optional: specify a custom profile name if needed
        return "integration-test";
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        // Enable the PUT/upsert paths so the MCP updateArchitecture tool and the
        // equivalent REST PUT endpoint can be exercised by the integration suite.
        //
        // calm.audit.* re-enables audit logging, which the %test. block in
        // src/main/resources/application.properties disables for the general unit-test
        // suite (to avoid every mutating-endpoint resource test depending on live Mongo).
        // Integration tests run against a real, controlled Mongo container and
        // deliberately need this on — see
        // MongoAuditLogIntegration/MongoAuditLogDeniedIntegration.
        return Map.of(
                "allow.put.operations", "true",
                "calm.mcp.enabled", "true",
                "calm.auth.enabled","false",
                "calm.hub.base-url", "http://localhost:8080",
                "calm.audit.store.enabled", "true",
                "calm.audit.log.enabled", "true"
        );
    }
}

