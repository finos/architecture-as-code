package integration;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.List;
import java.util.Map;
import java.util.Set;

public class IntegrationTestProxyAuthProfile implements QuarkusTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of();
    }

    @Override
    public String getConfigProfile() {
        return "proxy-auth";
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("allow.put.operations", "true");
    }

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(EndToEndResource.class));
    }
}
