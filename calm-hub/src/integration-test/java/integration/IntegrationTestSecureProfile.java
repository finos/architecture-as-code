package integration;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;
import java.util.Set;

@QuarkusTestResource.List({
        @QuarkusTestResource(EndToEndResource.class),
        @QuarkusTestResource(KeycloakTestResource.class)
})
public class IntegrationTestSecureProfile implements QuarkusTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        // Optionally, return specific classes you want enabled only for this profile
        return Set.of();
    }

    @Override
    public String getConfigProfile() {
        // Optional: specify a custom profile name if needed
        return "secure";
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        // override the following secure profile's properties to start the application container with http
        return Map.of(
                "quarkus.profile", "secure",
                "quarkus.http.ssl-port", "0",
                "quarkus.http.insecure-requests", "enabled",
                "quarkus.http.port", "8080",
                "quarkus.http.ssl.certificate.key-files","",
                "quarkus.http.ssl.certificate.key-store-file-type","",
                "quarkus.http.ssl.certificate.files",""
        );
    }
}