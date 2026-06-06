package integration;

import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;
import java.util.Set;

@QuarkusTestResource(EndToEndResource.class)
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
}
