package integration;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.List;
import java.util.Map;

public class NitritePersonalNamespacesProfile implements QuarkusTestProfile {

    @Override
    public String getConfigProfile() {
        return "proxy-auth";
    }

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(NitriteEndToEndResource.class));
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "calm.namespaces.personal.enabled", "true",
                "calm.hub.base-url", "http://localhost:8080"
        );
    }
}
