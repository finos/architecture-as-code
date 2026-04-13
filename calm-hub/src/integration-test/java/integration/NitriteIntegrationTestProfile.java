package integration;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.List;
import java.util.Set;

public class NitriteIntegrationTestProfile implements QuarkusTestProfile {

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of();
    }

    @Override
    public String getConfigProfile() {
        return "nitrite-integration-test";
    }

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(NitriteEndToEndResource.class));
    }
}
