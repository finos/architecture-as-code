package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;

public class AllowPutProfile implements QuarkusTestProfile {
    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "allow.put.operations", "true"
        );
    }
}
