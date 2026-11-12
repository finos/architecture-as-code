package integration;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.List;
import java.util.Map;

public class IntegrationTestPersonalNamespacesProfile implements QuarkusTestProfile {

    @Override
    public String getConfigProfile() {
        return "proxy-auth";
    }

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(EndToEndResource.class));
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("calm.namespaces.personal.enabled", "true");
    }
}
