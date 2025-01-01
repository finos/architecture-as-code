package integration;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTestProfile;

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
}

